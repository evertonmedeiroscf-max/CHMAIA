import type { EntidadeTipo, StatusPedido } from '@/lib/types/domain'

// Lembrete "situação financeira dos eventos de amanhã": funções puras (sem banco, sem tela) para
// descobrir qual é "amanhã" e resumir o que falta receber.

// "Hoje" e "amanhã" são sempre no fuso do buffet. O servidor da Vercel roda em UTC: às 22h de
// Brasília já é o dia seguinte lá, e usar a data do servidor mostraria os eventos errados.
const FUSO = 'America/Sao_Paulo'

// Soma (ou subtrai) dias a uma data "AAAA-MM-DD", sem depender de fuso horário. Date.UTC resolve
// virada de mês/ano e 29/02 sozinho (ex.: 31/12 + 1 = 01/01 do ano seguinte).
export function somarDias(dataIso: string, dias: number): string {
  const [ano, mes, dia] = dataIso.split('-').map(Number)
  return new Date(Date.UTC(ano, mes - 1, dia + dias)).toISOString().slice(0, 10)
}

// Devolve a data de hoje no formato "AAAA-MM-DD", no fuso de São Paulo.
export function dataHojeBR(agora: Date = new Date()): string {
  const partes = new Intl.DateTimeFormat('en-US', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(agora)
  const valor = (tipo: string) => partes.find((p) => p.type === tipo)?.value
  return `${valor('year')}-${valor('month')}-${valor('day')}`
}

// Devolve a data de amanhã no formato "AAAA-MM-DD", no fuso de São Paulo.
export function dataAmanhaBR(agora: Date = new Date()): string {
  return somarDias(dataHojeBR(agora), 1)
}

const DIAS_SEMANA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']

// "AAAA-MM-DD" -> "quarta-feira". Calculado em UTC de propósito: não depende do fuso de quem vê.
export function nomeDiaSemana(dataIso: string): string {
  const [ano, mes, dia] = dataIso.split('-').map(Number)
  return DIAS_SEMANA[new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay()] ?? ''
}

// Só os campos do pedido que o lembrete precisa.
export type EventoAmanha = {
  id: string
  cliente: string
  // PF = pessoa física, PJ = pessoa jurídica (como o pedido foi cadastrado).
  entidade: EntidadeTipo
  hora_evento: string | null
  valor_total: number
  valor_pago: number
  falta_pagar: number
  status: StatusPedido
}

// Pedido que o lembrete destaca com mais força: cliente PESSOA FÍSICA que ainda NÃO pagou tudo
// (pendente ou só 50% pago). Pessoa jurídica e pedido já pago ficam com o visual normal.
export function pedidoPedeAtencao(e: Pick<EventoAmanha, 'entidade' | 'status'>): boolean {
  return e.entidade === 'PF' && e.status !== 'pago'
}

export type ResumoEventosAmanha = {
  total: number
  pagos: number
  faltaReceber: number
}

export function resumirEventos(eventos: EventoAmanha[]): ResumoEventosAmanha {
  const faltaCentavos = eventos.reduce((soma, e) => soma + Math.max(0, Math.round((e.falta_pagar ?? 0) * 100)), 0)
  return {
    total: eventos.length,
    pagos: eventos.filter((e) => e.status === 'pago').length,
    faltaReceber: faltaCentavos / 100,
  }
}

export const STATUS_EVENTO_LABEL: Record<StatusPedido, string> = {
  pendente: 'PENDENTE',
  '50% pago': '50% PAGO',
  pago: 'PAGO',
}

export const STATUS_EVENTO_BADGE: Record<StatusPedido, string> = {
  pendente: 'badge-pendente',
  '50% pago': 'badge-50pago',
  pago: 'badge-pago',
}
