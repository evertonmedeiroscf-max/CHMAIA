import { createSign } from 'node:crypto'
import { formatCurrency } from '@/lib/utils/format'

// Sincroniza pedidos com a Google Agenda de um e-mail específico (o do
// buffet), usando uma conta de serviço do Google Cloud que precisa ter sido
// convidada como editora dessa agenda (ver README/CLAUDE.md para o passo a
// passo de configuração). Sem as três variáveis abaixo configuradas, toda
// função aqui vira um no-op silencioso — cadastrar/editar/excluir um pedido
// nunca pode falhar por causa da agenda estar (ainda) desconfigurada ou fora
// do ar.
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

export type PedidoParaAgenda = {
  numero: number
  cliente: string
  data_evento: string | null
  hora_evento: string | null
  valor_total: number
  status: string
  entidade: string
}

function integracaoConfigurada() {
  return !!(CALENDAR_ID && CLIENT_EMAIL && PRIVATE_KEY)
}

function base64url(dados: object | Buffer) {
  const buffer = Buffer.isBuffer(dados) ? dados : Buffer.from(JSON.stringify(dados))
  return buffer.toString('base64url')
}

async function obterTokenAcesso(): Promise<string> {
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
  return dados.access_token
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

async function chamarGoogleCalendar(metodo: 'POST' | 'PUT' | 'DELETE', caminho: string, corpo?: object) {
  const token = await obterTokenAcesso()
  const resposta = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID!)}${caminho}`,
    {
      method: metodo,
      headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: corpo ? JSON.stringify(corpo) : undefined,
    }
  )
  // 404/410 num delete/update de um evento que já não existe mais do lado do
  // Google não é erro pra nós — só significa que não tem mais nada a fazer.
  if (!resposta.ok && resposta.status !== 404 && resposta.status !== 410) {
    throw new Error(`Google Calendar respondeu ${resposta.status}: ${await resposta.text()}`)
  }
  if (metodo === 'DELETE' || !resposta.ok) return null
  return (await resposta.json()) as { id: string }
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
  if (!integracaoConfigurada()) return eventoIdExistente

  try {
    if (!pedido.data_evento || !pedido.hora_evento) {
      if (eventoIdExistente) await chamarGoogleCalendar('DELETE', `/events/${eventoIdExistente}`)
      return null
    }

    const horaInicio = pedido.hora_evento.slice(0, 5)
    const corpo = montarCorpoEvento(pedido, horaInicio)

    if (eventoIdExistente) {
      const evento = await chamarGoogleCalendar('PUT', `/events/${eventoIdExistente}`, corpo)
      // PUT num evento que o Google já não tem mais (404/410) — cria de novo.
      if (evento) return evento.id
    }
    const evento = await chamarGoogleCalendar('POST', '/events', corpo)
    return evento?.id ?? eventoIdExistente
  } catch (erro) {
    console.error('[google-calendar] falha ao sincronizar evento do pedido', erro)
    return eventoIdExistente
  }
}

export async function excluirEventoPedido(eventoId: string | null): Promise<void> {
  if (!integracaoConfigurada() || !eventoId) return
  try {
    await chamarGoogleCalendar('DELETE', `/events/${eventoId}`)
  } catch (erro) {
    console.error('[google-calendar] falha ao excluir evento do pedido', erro)
  }
}
