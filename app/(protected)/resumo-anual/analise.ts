import { FATURAMENTO_HISTORICO } from '@/lib/data/faturamentoHistorico'
import type { Pedido } from '@/lib/types/domain'

export const MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]
export const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

export type PontoMes = {
  valor: number
  pedidos: number | null
  fonte: 'planilha' | 'sistema'
}

// Faturamento por ano → 12 meses. A planilha vale onde tem lançamento; nos
// demais meses entra a soma de valor_total dos pedidos do sistema (valor
// vendido, não o recebido — mesmo critério da planilha).
export function montarFaturamento(pedidos: Pedido[]): Map<number, (PontoMes | null)[]> {
  const doSistema = new Map<string, { valor: number; pedidos: number }>()
  pedidos.forEach((p) => {
    const chave = p.data_venda.slice(0, 7)
    const atual = doSistema.get(chave) ?? { valor: 0, pedidos: 0 }
    atual.valor += p.valor_total
    atual.pedidos += 1
    doSistema.set(chave, atual)
  })

  const anos = new Set<number>(Object.keys(FATURAMENTO_HISTORICO).map(Number))
  doSistema.forEach((_, chave) => anos.add(Number(chave.slice(0, 4))))

  const resultado = new Map<number, (PontoMes | null)[]>()
  ;[...anos]
    .sort((a, b) => a - b)
    .forEach((ano) => {
      const hist = FATURAMENTO_HISTORICO[ano]
      resultado.set(
        ano,
        MESES.map((_, i) => {
          const valorPlanilha = hist?.valores[i]
          if (valorPlanilha != null) {
            return { valor: valorPlanilha, pedidos: hist?.pedidos?.[i] ?? null, fonte: 'planilha' }
          }
          const sis = doSistema.get(`${ano}-${String(i + 1).padStart(2, '0')}`)
          return sis ? { valor: sis.valor, pedidos: sis.pedidos, fonte: 'sistema' } : null
        })
      )
    })
  return resultado
}

export const soma = (pontos: (PontoMes | null)[], ate = 12) =>
  pontos.slice(0, ate).reduce((s, p) => s + (p?.valor ?? 0), 0)

export const variacao = (atual: number, anterior: number) => (anterior > 0 ? atual / anterior - 1 : null)

export function ultimoMesComDado(pontos: (PontoMes | null)[]) {
  for (let i = pontos.length - 1; i >= 0; i--) if (pontos[i]) return i
  return -1
}

const pct = (v: number) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(0).replace('.', ',')}%`
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

export type Insight = { tipo: 'positivo' | 'atencao' | 'info'; titulo: string; texto: string }

// Leituras automáticas para decisão. Só usa meses com dado no ano escolhido
// e compara sempre o mesmo período do ano anterior (comparação justa).
export function gerarInsights(ano: number, serie: (PontoMes | null)[], anterior: (PontoMes | null)[] | undefined) {
  const insights: Insight[] = []
  const ultimo = ultimoMesComDado(serie)
  if (ultimo < 0) return insights
  const periodo = `jan–${MESES_CURTOS[ultimo].toLowerCase()}`
  const acumulado = soma(serie, ultimo + 1)

  if (anterior) {
    const accAnterior = soma(anterior, ultimo + 1)
    const v = variacao(acumulado, accAnterior)
    if (v != null) {
      insights.push({
        tipo: v >= 0 ? 'positivo' : 'atencao',
        titulo: `${v >= 0 ? 'Crescimento' : 'Queda'} de ${pct(v)} no acumulado`,
        texto: `${ano} faturou ${brl(acumulado)} em ${periodo}, contra ${brl(accAnterior)} no mesmo período de ${ano - 1}.`,
      })
    }

    const quedas = serie
      .slice(0, ultimo + 1)
      .map((p, i) => ({ i, v: p && anterior[i] ? variacao(p.valor, anterior[i]!.valor) : null }))
      .filter((m): m is { i: number; v: number } => m.v != null && m.v < 0)
    if (quedas.length) {
      insights.push({
        tipo: 'atencao',
        titulo: `${quedas.length} ${quedas.length === 1 ? 'mês abaixo' : 'meses abaixo'} de ${ano - 1}`,
        texto: `${quedas.map((q) => `${MESES[q.i]} (${pct(q.v)})`).join(', ')}. Vale entender o que mudou nesses meses (agenda, preço, divulgação) antes de repetir o planejamento.`,
      })
    }
  }

  const comDado = serie.map((p, i) => ({ p, i })).filter((m): m is { p: PontoMes; i: number } => m.p != null)
  const melhor = comDado.reduce((a, b) => (b.p.valor > a.p.valor ? b : a))
  const pior = comDado.reduce((a, b) => (b.p.valor < a.p.valor ? b : a))
  const media = acumulado / comDado.length
  insights.push({
    tipo: 'info',
    titulo: `Melhor mês: ${MESES[melhor.i]} (${brl(melhor.p.valor)})`,
    texto: `Pior mês: ${MESES[pior.i]} (${brl(pior.p.valor)}), ${pct(pior.p.valor / media - 1)} em relação à média mensal de ${brl(media)}.`,
  })

  // Volume x ticket: mês de mais pedidos costuma ter ticket menor.
  const comPedidos = comDado.filter((m) => m.p.pedidos)
  if (comPedidos.length >= 3) {
    const totalPedidos = comPedidos.reduce((s, m) => s + m.p.pedidos!, 0)
    const ticketMedio = comPedidos.reduce((s, m) => s + m.p.valor, 0) / totalPedidos
    const maisPedidos = comPedidos.reduce((a, b) => (b.p.pedidos! > a.p.pedidos! ? b : a))
    const ticketMes = maisPedidos.p.valor / maisPedidos.p.pedidos!
    const dif = ticketMes / ticketMedio - 1
    if (dif < -0.15) {
      insights.push({
        tipo: 'atencao',
        titulo: `Mais pedidos, ticket menor em ${MESES[maisPedidos.i]}`,
        texto: `${MESES[maisPedidos.i]} teve o maior volume (${maisPedidos.p.pedidos} pedidos), mas ticket de ${brl(ticketMes)} — ${pct(dif)} vs a média de ${brl(ticketMedio)}. Avaliar pedido mínimo, combos ou taxa para pedidos pequenos.`,
      })
    }
  }

  // Sazonalidade: peso do 4º trimestre no último ano completo.
  if (anterior && anterior.every((p) => p)) {
    const totalAnt = soma(anterior)
    const q4 = soma(anterior.slice(9))
    const dez = anterior[11]!.valor
    insights.push({
      tipo: 'info',
      titulo: `Out–dez = ${((q4 / totalAnt) * 100).toFixed(0)}% do ano de ${ano - 1}`,
      texto: `Só dezembro representou ${((dez / totalAnt) * 100).toFixed(0)}% (${brl(dez)}). Garantir agenda, equipe e estoque para o fim de ano define o resultado anual.`,
    })
  }

  return insights
}
