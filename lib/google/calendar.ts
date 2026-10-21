import { createSign } from 'node:crypto'
import { formatCurrency } from '@/lib/utils/format'

// Sincroniza pedidos com a Google Agenda do buffet. Há dois jeitos de ligar,
// escolhidos pelas variáveis de ambiente presentes:
//
// 1. Apps Script (preferido quando as duas variáveis abaixo existem): um
//    script publicado como "app da Web" dentro da própria conta Google dona da
//    agenda (ver `docs/google-agenda-apps-script.gs`). Não precisa de projeto
//    no Google Cloud nem de chave de conta de serviço — útil quando a
//    organização do Google Cloud bloqueia a criação de chaves.
// 2. Conta de serviço do Google Cloud convidada como editora da agenda (as
//    três variáveis GOOGLE_CALENDAR_*; passo a passo no CLAUDE.md).
//
// Sem nenhum dos dois configurado, toda função aqui vira um no-op silencioso —
// cadastrar/editar/excluir um pedido nunca pode falhar por causa da agenda
// estar (ainda) desconfigurada ou fora do ar.
const APPS_SCRIPT_URL = process.env.GOOGLE_APPS_SCRIPT_URL
const APPS_SCRIPT_TOKEN = process.env.GOOGLE_APPS_SCRIPT_TOKEN

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID
const CLIENT_EMAIL = process.env.GOOGLE_CALENDAR_CLIENT_EMAIL
// No Vercel/`.env.local` a chave privada vem com "\n" escapado (não dá pra
// colar quebra de linha real numa variável de ambiente) — desfaz isso aqui.
const PRIVATE_KEY = process.env.GOOGLE_CALENDAR_PRIVATE_KEY?.replace(/\\n/g, '\n')

// Duração assumida de um evento — o pedido só guarda a hora de início, não
// tem campo de hora de término. 3h é uma estimativa razoável pra um evento
// de buffet; ajuste aqui se o padrão real for outro.
const DURACAO_EVENTO_HORAS = 3
const FUSO_HORARIO = 'America/Sao_Paulo'

// Quantos eventos são enviados ao mesmo tempo no modo conta de serviço — acelera
// o envio em lote sem estourar o limite de taxa do Google.
const CONCORRENCIA_CONTA_SERVICO = 4

export type PedidoParaAgenda = {
  numero: number
  cliente: string
  data_evento: string | null
  hora_evento: string | null
  valor_total: number
  status: string
  entidade: string
}

type Modo = 'apps-script' | 'conta-servico' | null

function modoIntegracao(): Modo {
  if (APPS_SCRIPT_URL && APPS_SCRIPT_TOKEN) return 'apps-script'
  if (CALENDAR_ID && CLIENT_EMAIL && PRIVATE_KEY) return 'conta-servico'
  return null
}

// Usado pela tela de Pedidos pra saber se vale oferecer o botão de sincronizar.
export function googleAgendaConfigurada() {
  return modoIntegracao() !== null
}

// Soma horas a uma data+hora "de parede" (sem fuso), sem deixar o fuso do
// servidor interferir — a data/hora resultante é interpretada como
// America/Sao_Paulo explicitamente no evento enviado ao Google.
function somarHoras(dataISO: string, horaISO: string, horas: number) {
  const [ano, mes, dia] = dataISO.split('-').map(Number)
  const [h, m] = horaISO.split(':').map(Number)
  const base = new Date(Date.UTC(ano, mes - 1, dia, h, m))
  base.setUTCHours(base.getUTCHours() + horas)
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    data: `${base.getUTCFullYear()}-${pad(base.getUTCMonth() + 1)}-${pad(base.getUTCDate())}`,
    hora: `${pad(base.getUTCHours())}:${pad(base.getUTCMinutes())}`,
  }
}

function montarCorpoEvento(pedido: PedidoParaAgenda, horaInicio: string) {
  const fim = somarHoras(pedido.data_evento!, horaInicio, DURACAO_EVENTO_HORAS)
  return {
    summary: `Pedido #${pedido.numero} — ${pedido.cliente}`,
    description: [
      `Valor total: ${formatCurrency(pedido.valor_total)}`,
      `Status: ${pedido.status}`,
      `Entidade: ${pedido.entidade === 'PF' ? 'Pessoa Física' : 'Pessoa Jurídica'}`,
      '',
      'Gerado automaticamente pelo sistema Chef Hilana Maia — edite o pedido no sistema, não aqui.',
    ].join('\n'),
    start: { dateTime: `${pedido.data_evento}T${horaInicio}:00`, timeZone: FUSO_HORARIO },
    end: { dateTime: `${fim.data}T${fim.hora}:00`, timeZone: FUSO_HORARIO },
  }
}

// ---------------------------------------------------------------------------
// Modo 1 — Apps Script
// ---------------------------------------------------------------------------

type OperacaoAppsScript = {
  eventoId: string | null
  excluir: boolean
  titulo?: string
  descricao?: string
  // "AAAA-MM-DDTHH:mm:ss" no fuso America/Sao_Paulo (o script interpreta assim).
  inicio?: string
  fim?: string
}

type RespostaOperacaoAppsScript = { ok: true; eventoId: string | null } | { ok: false; erro: string }

// Manda uma ou várias operações de uma vez e devolve uma resposta por operação,
// na mesma ordem. Lança se o script em si não responder direito (URL errada,
// senha errada, implantação não pública...).
async function chamarAppsScript(operacoes: OperacaoAppsScript[]): Promise<RespostaOperacaoAppsScript[]> {
  const resposta = await fetch(APPS_SCRIPT_URL!, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: APPS_SCRIPT_TOKEN, operacoes }),
    // O Apps Script responde o POST com um redirecionamento (302) pra uma URL
    // onde está o resultado — o fetch precisa seguir.
    redirect: 'follow',
    signal: AbortSignal.timeout(55_000),
  })

  const texto = await resposta.text()

  // 401/403: o Google barrou o pedido antes de chegar no script — quase sempre
  // porque a implantação não está como "Qualquer pessoa", ou foi alterada sem
  // salvar como "Nova versão".
  if (resposta.status === 401 || resposta.status === 403) {
    throw new Error(
      `O Google bloqueou o acesso ao script (HTTP ${resposta.status}). Na implantação do Apps Script, "Quem tem acesso" precisa ser "Qualquer pessoa", e a mudança só vale depois de salvar como "Nova versão". Teste abrindo a URL numa janela anônima: deve aparecer {"ok":true,...} sem pedir login.`
    )
  }

  let dados: { erro?: string; resultados?: RespostaOperacaoAppsScript[] }
  try {
    dados = JSON.parse(texto)
  } catch {
    // Quando a implantação não está como "Qualquer pessoa", ou a URL não termina
    // em /exec, o Google devolve uma página HTML (login/erro) em vez do JSON.
    throw new Error(
      `O Apps Script não respondeu como esperado (HTTP ${resposta.status}). Confira se a URL termina em /exec e se a implantação está com acesso "Qualquer pessoa".`
    )
  }
  if (dados.erro) throw new Error(`Apps Script: ${dados.erro}`)
  if (!Array.isArray(dados.resultados) || dados.resultados.length !== operacoes.length) {
    throw new Error('O Apps Script devolveu uma resposta incompleta.')
  }
  return dados.resultados
}

// Traduz "pedido + id de evento atual" na operação a enviar. Devolve null
// quando não há nada a fazer (pedido sem data/hora e sem evento antigo).
function montarOperacaoAppsScript(pedido: PedidoParaAgenda, eventoIdExistente: string | null): OperacaoAppsScript | null {
  if (!pedido.data_evento || !pedido.hora_evento) {
    return eventoIdExistente ? { eventoId: eventoIdExistente, excluir: true } : null
  }
  const corpo = montarCorpoEvento(pedido, pedido.hora_evento.slice(0, 5))
  return {
    eventoId: eventoIdExistente,
    excluir: false,
    titulo: corpo.summary,
    descricao: corpo.description,
    inicio: corpo.start.dateTime,
    fim: corpo.end.dateTime,
  }
}

// ---------------------------------------------------------------------------
// Modo 2 — Conta de serviço do Google Cloud
// ---------------------------------------------------------------------------

// O token do Google vale 1h. Guarda por ~50 min pra o envio em lote (vários
// pedidos de uma vez) não pedir um token novo a cada evento.
let tokenEmCache: { token: string; expiraEm: number } | null = null

function base64url(dados: object | Buffer) {
  const buffer = Buffer.isBuffer(dados) ? dados : Buffer.from(JSON.stringify(dados))
  return buffer.toString('base64url')
}

async function obterTokenAcesso(): Promise<string> {
  if (tokenEmCache && tokenEmCache.expiraEm > Date.now()) return tokenEmCache.token

  const agora = Math.floor(Date.now() / 1000)
  const semAssinar = `${base64url({ alg: 'RS256', typ: 'JWT' })}.${base64url({
    iss: CLIENT_EMAIL,
    scope: 'https://www.googleapis.com/auth/calendar',
    aud: 'https://oauth2.googleapis.com/token',
    iat: agora,
    exp: agora + 3600,
  })}`
  const assinatura = createSign('RSA-SHA256').update(semAssinar).sign(PRIVATE_KEY!)
  const jwt = `${semAssinar}.${base64url(assinatura)}`

  const resposta = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  if (!resposta.ok) throw new Error(`Falha ao autenticar no Google (${resposta.status}): ${await resposta.text()}`)
  const dados = (await resposta.json()) as { access_token: string }
  tokenEmCache = { token: dados.access_token, expiraEm: Date.now() + 50 * 60 * 1000 }
  return dados.access_token
}

const ESPERA_ENTRE_TENTATIVAS_MS = [1000, 3000]

async function chamarGoogleCalendar(metodo: 'POST' | 'PUT' | 'DELETE', caminho: string, corpo?: object) {
  const token = await obterTokenAcesso()
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID!)}${caminho}`
  const opcoes = {
    method: metodo,
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: corpo ? JSON.stringify(corpo) : undefined,
  }

  let resposta = await fetch(url, opcoes)
  // O Google limita a taxa de criação de eventos (429, ou 403 "rateLimit...").
  // No envio em lote isso pode acontecer — espera um pouco e tenta de novo.
  for (const espera of ESPERA_ENTRE_TENTATIVAS_MS) {
    if (resposta.ok) break
    const limitado =
      resposta.status === 429 || (resposta.status === 403 && /rateLimit/i.test(await resposta.clone().text()))
    if (!limitado) break
    await new Promise((resolver) => setTimeout(resolver, espera))
    resposta = await fetch(url, opcoes)
  }

  // 404/410 num delete/update de um evento que já não existe mais do lado do
  // Google não é erro pra nós — só significa que não tem mais nada a fazer.
  if (!resposta.ok && resposta.status !== 404 && resposta.status !== 410) {
    throw new Error(`Google Calendar respondeu ${resposta.status}: ${await resposta.text()}`)
  }
  if (metodo === 'DELETE' || !resposta.ok) return null
  return (await resposta.json()) as { id: string }
}

async function sincronizarViaContaServico(pedido: PedidoParaAgenda, eventoIdExistente: string | null) {
  if (!pedido.data_evento || !pedido.hora_evento) {
    if (eventoIdExistente) await chamarGoogleCalendar('DELETE', `/events/${eventoIdExistente}`)
    return null
  }

  const corpo = montarCorpoEvento(pedido, pedido.hora_evento.slice(0, 5))

  if (eventoIdExistente) {
    const evento = await chamarGoogleCalendar('PUT', `/events/${eventoIdExistente}`, corpo)
    // PUT num evento que o Google já não tem mais (404/410) — cria de novo.
    if (evento) return evento.id
  }
  const evento = await chamarGoogleCalendar('POST', '/events', corpo)
  return evento?.id ?? eventoIdExistente
}

// ---------------------------------------------------------------------------
// API usada pelo resto do sistema
// ---------------------------------------------------------------------------

export type ItemSincronizacao = { pedido: PedidoParaAgenda; eventoIdExistente: string | null }

export type ResultadoSincronizacaoPedido =
  | { ok: true; eventoId: string | null; criado: boolean }
  | { ok: false; erro: string }

function mensagemDeErro(erro: unknown) {
  return erro instanceof Error ? erro.message : String(erro)
}

// Sincroniza vários pedidos de uma vez e devolve um resultado por item, na
// mesma ordem. Nunca lança: falhas viram `{ ok: false }` pra o chamador
// poder mostrar no resumo do envio em lote.
export async function sincronizarPedidosEmLote(itens: ItemSincronizacao[]): Promise<ResultadoSincronizacaoPedido[]> {
  const modo = modoIntegracao()
  if (!modo) {
    return itens.map(() => ({ ok: false, erro: 'A integração com a Google Agenda não está configurada.' }))
  }

  const sucesso = (eventoId: string | null, anterior: string | null): ResultadoSincronizacaoPedido => ({
    ok: true,
    eventoId,
    criado: !!eventoId && eventoId !== anterior,
  })

  if (modo === 'apps-script') {
    // Uma única chamada pro lote inteiro (cada chamada ao Apps Script tem um
    // custo fixo de ~1-2s). Itens sem nada a fazer nem são enviados.
    const resultados: ResultadoSincronizacaoPedido[] = itens.map((i) => sucesso(null, i.eventoIdExistente))
    const operacoes: OperacaoAppsScript[] = []
    const indices: number[] = []
    itens.forEach((item, i) => {
      const operacao = montarOperacaoAppsScript(item.pedido, item.eventoIdExistente)
      if (operacao) {
        operacoes.push(operacao)
        indices.push(i)
      }
    })
    if (operacoes.length === 0) return resultados

    try {
      const respostas = await chamarAppsScript(operacoes)
      respostas.forEach((resposta, j) => {
        const i = indices[j]
        resultados[i] = resposta.ok ? sucesso(resposta.eventoId, itens[i].eventoIdExistente) : { ok: false, erro: resposta.erro }
      })
    } catch (erro) {
      console.error('[google-calendar] falha ao falar com o Apps Script', erro)
      for (const i of indices) resultados[i] = { ok: false, erro: mensagemDeErro(erro) }
    }
    return resultados
  }

  const resultados: ResultadoSincronizacaoPedido[] = new Array(itens.length)
  let proximo = 0
  async function trabalhador() {
    while (proximo < itens.length) {
      const i = proximo++
      try {
        const eventoId = await sincronizarViaContaServico(itens[i].pedido, itens[i].eventoIdExistente)
        resultados[i] = sucesso(eventoId, itens[i].eventoIdExistente)
      } catch (erro) {
        console.error('[google-calendar] falha ao sincronizar pedido em lote', erro)
        resultados[i] = { ok: false, erro: mensagemDeErro(erro) }
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCORRENCIA_CONTA_SERVICO, itens.length) }, trabalhador))
  return resultados
}

// Cria o evento (se `eventoIdExistente` for null) ou atualiza o já existente.
// Se o pedido não tiver mais data/hora de evento, apaga o evento antigo (se
// havia um) em vez de criar/atualizar. Retorna o id do evento pra gravar em
// `google_calendar_event_id`, ou null (integração desconfigurada, pedido sem
// data/hora, ou evento apagado). Nunca lança — falha na agenda não pode
// derrubar o cadastro do pedido.
export async function sincronizarEventoPedido(
  pedido: PedidoParaAgenda,
  eventoIdExistente: string | null
): Promise<string | null> {
  if (!modoIntegracao()) return eventoIdExistente

  const [resultado] = await sincronizarPedidosEmLote([{ pedido, eventoIdExistente }])
  if (resultado.ok) return resultado.eventoId
  console.error('[google-calendar] falha ao sincronizar evento do pedido', resultado.erro)
  return eventoIdExistente
}

export async function excluirEventoPedido(eventoId: string | null): Promise<void> {
  const modo = modoIntegracao()
  if (!modo || !eventoId) return
  try {
    if (modo === 'apps-script') {
      const [resposta] = await chamarAppsScript([{ eventoId, excluir: true }])
      if (!resposta.ok) throw new Error(resposta.erro)
    } else {
      await chamarGoogleCalendar('DELETE', `/events/${eventoId}`)
    }
  } catch (erro) {
    console.error('[google-calendar] falha ao excluir evento do pedido', erro)
  }
}
