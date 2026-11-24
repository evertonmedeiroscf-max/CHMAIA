import { formatCurrency, formatDateBR } from '@/lib/utils/format'
import {
  nomeDiaSemana,
  resumirEventos,
  somarDias,
  STATUS_EVENTO_LABEL,
  type EventoAmanha,
} from '@/lib/utils/eventosAmanha'

// Lembrete diário na Google Agenda: um evento por dia, colocado no dia ANTERIOR aos eventos, com a
// situação financeira deles (é a versão "na agenda" do pop-up de eventos de amanhã do sistema).
// Parte pura (sem banco e sem Google) para poder ser testada.

// Horário do lembrete na agenda (fuso de São Paulo). Quem tem as notificações padrão da Google Agenda
// ligadas recebe o aviso por volta desse horário.
export const HORA_INICIO_LEMBRETE = '10:00'
export const HORA_FIM_LEMBRETE = '10:30'

// O lembrete dos eventos do dia X fica na agenda no dia X - 1.
export function diaDoLembrete(dataEvento: string): string {
  return somarDias(dataEvento, -1)
}

export type LembreteAgenda = {
  titulo: string
  descricao: string
  // "AAAA-MM-DDTHH:mm:ss" no fuso America/Sao_Paulo, como o resto da integração.
  inicio: string
  fim: string
}

function linhaDoEvento(e: EventoAmanha): string {
  const hora = e.hora_evento ? e.hora_evento.slice(0, 5) : 'Sem horário'
  const falta = e.valor_pago > 0 && e.falta_pagar > 0 ? ` (falta ${formatCurrency(e.falta_pagar)})` : ''
  return `• ${hora} — ${e.cliente} — ${formatCurrency(e.valor_total)} — ${STATUS_EVENTO_LABEL[e.status]}${falta}`
}

// `eventos` = os pedidos cujo evento é em `dataEvento` (já na ordem do dia). Precisa de pelo menos um.
export function montarLembreteAgenda(dataEvento: string, eventos: EventoAmanha[]): LembreteAgenda {
  const resumo = resumirEventos(eventos)
  const tudoPago = resumo.faltaReceber === 0 && resumo.pagos === resumo.total
  const [, mes, dia] = dataEvento.split('-')
  const situacao = tudoPago ? 'tudo pago' : `falta receber ${formatCurrency(resumo.faltaReceber)}`
  const quantidade = resumo.total === 1 ? '1 evento' : `${resumo.total} eventos`
  const diaLembrete = diaDoLembrete(dataEvento)

  return {
    titulo: `Eventos de amanhã (${dia}/${mes}): ${situacao}`,
    descricao: [
      `Eventos de amanhã — ${formatDateBR(dataEvento)} (${nomeDiaSemana(dataEvento)})`,
      `${quantidade} · ${situacao}`,
      '',
      ...eventos.map(linhaDoEvento),
      '',
      'Gerado automaticamente pelo sistema Chef Hilana Maia — muda sozinho quando um pedido é alterado no sistema. Não edite aqui.',
    ].join('\n'),
    inicio: `${diaLembrete}T${HORA_INICIO_LEMBRETE}:00`,
    fim: `${diaLembrete}T${HORA_FIM_LEMBRETE}:00`,
  }
}
