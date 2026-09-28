import type { EntidadeTipo, ItemOrcamento, SecaoOrcamento } from '@/lib/types/domain'

// Mesma lógica das planilhas de custo: peso total = peso/kg × quantidade,
// valor = valor unitário × quantidade. peso_kg null (comum em itens de
// Serviço) simplesmente não gera peso total.
export function pesoTotalItem(item: ItemOrcamento): number {
  return (item.peso_kg ?? 0) * item.quantidade
}

export function valorItem(item: ItemOrcamento): number {
  return item.valor_unit * item.quantidade
}

export function subtotalSecao(secao: SecaoOrcamento): { peso: number; valor: number } {
  return secao.itens.reduce(
    (acc, item) => ({ peso: acc.peso + pesoTotalItem(item), valor: acc.valor + valorItem(item) }),
    { peso: 0, valor: 0 }
  )
}

// "Panelinha para adicionar" é opcional: na proposta aparece como valor
// por pessoa a acrescentar ("R$12,00 POR PESSOA"), fora do total do
// cardápio — igual ao modelo de proposta do usuário.
export const SECAO_OPCIONAL = 'Panelinha para adicionar'

export function secaoOpcional(secao: SecaoOrcamento): boolean {
  return secao.nome.trim().toLowerCase() === SECAO_OPCIONAL.toLowerCase()
}

// Soma das seções que entram no preço (comida + serviço, sem as opcionais)
// — é o "Total" antes dos extras, igual às planilhas de referência.
export function subtotalGeral(secoes: SecaoOrcamento[]): number {
  return secoes.filter((s) => !secaoOpcional(s)).reduce((soma, secao) => soma + subtotalSecao(secao).valor, 0)
}

// Preço por pessoa de uma seção opcional, com o mesmo % de extras do
// orçamento (é o valor que o cliente acrescenta se quiser o adicional).
export function valorOpcionalPorPessoa(secao: SecaoOrcamento, percentualExtras: number, numeroPessoas: number | null) {
  if (!numeroPessoas) return 0
  return (subtotalSecao(secao).valor * (1 + percentualExtras / 100)) / numeroPessoas
}

export interface ResumoOrcamento {
  subtotal: number
  extras: number
  valorTotal: number
  valorPorPessoa: number
}

// Extras (ex.: 12%, 6%) incide sobre o total de entradas+serviço; valor por
// pessoa divide o valor final pelo número de pessoas do evento.
export function calcularResumo(
  secoes: SecaoOrcamento[],
  percentualExtras: number,
  numeroPessoas: number | null
): ResumoOrcamento {
  const subtotal = subtotalGeral(secoes)
  const extras = subtotal * (percentualExtras / 100)
  const valorTotal = subtotal + extras
  const valorPorPessoa = numeroPessoas ? valorTotal / numeroPessoas : 0
  return { subtotal, extras, valorTotal, valorPorPessoa }
}

// Regra de equipe do modelo de orçamento do usuário: auxiliares = 1 a cada
// 20 pessoas + 1 só para as taças; garçons = 1 a cada 50 pessoas na bebida
// + 1 a cada 20 na comida (o maître conta como garçom). Arredonda para
// baixo, com no mínimo 1 em cada frente — no modelo, 50 pessoas → 3
// auxiliares + 3 garçons (2 garçons + maître) = 6.
export function sugerirEquipe(pessoas: number): { auxiliares: number; garcons: number } {
  const porFaixa = (divisor: number) => Math.max(1, Math.floor(pessoas / divisor))
  return {
    auxiliares: porFaixa(20) + 1,
    garcons: porFaixa(50) + porFaixa(20),
  }
}

// Ponto de partida de um orçamento novo: só as seções Mesa fixa (comida,
// com peso) e Serviços, sem nenhum item — os itens entram pelo "+ do
// catálogo" ou "+ item". Mais seções podem ser adicionadas depois.
export function planilhaModelo(): SecaoOrcamento[] {
  return [
    { nome: 'Mesa fixa', tipo: 'comida', itens: [] },
    { nome: 'Serviços', tipo: 'servico', itens: [] },
  ]
}

// Opções fixas do nome de seção da planilha (seletor no cabeçalho de cada
// seção), na ordem em que aparecem. O tipo é o sugerido ao escolher —
// "Serviços" não tem peso; as demais são comida.
export const SECOES_ORCAMENTO: { nome: string; tipo: SecaoOrcamento['tipo'] }[] = [
  { nome: 'Para começar', tipo: 'comida' },
  { nome: 'Mesa fixa', tipo: 'comida' },
  { nome: 'Panelinha para adicionar', tipo: 'comida' },
  { nome: 'Serviços', tipo: 'servico' },
  { nome: 'Mini refeição', tipo: 'comida' },
  { nome: 'Refeição', tipo: 'comida' },
]

export const DIAS_VALIDADE_ORCAMENTO = 30

// % de extras com que o orçamento começa, conforme o tipo de cliente:
// 12% para PJ (pessoa jurídica) e 6% para PF (pessoa física). Pode ser
// alterado em cada orçamento (inclusive para 0) no campo "% extras".
export const PERCENTUAL_EXTRAS_PADRAO: Record<EntidadeTipo, number> = { PJ: 12, PF: 6 }

// Validade da proposta: sempre 30 dias corridos após a data do orçamento.
// Conta em UTC sobre a data "yyyy-MM-dd" para não pular/perder um dia por
// causa do fuso horário.
export function calcularValidade(dataOrcamento: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataOrcamento)) return null
  const data = new Date(`${dataOrcamento}T00:00:00Z`)
  data.setUTCDate(data.getUTCDate() + DIAS_VALIDADE_ORCAMENTO)
  return data.toISOString().slice(0, 10)
}
