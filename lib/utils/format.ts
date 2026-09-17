export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value ?? 0)
}

// Evita usar `new Date(isoDate)`: em datas puras ("YYYY-MM-DD") isso é
// interpretado como UTC meia-noite e pode exibir o dia anterior em
// fusos horários negativos. Formatar as partes manualmente é seguro.
export function formatDateBR(isoDate: string): string {
  const [ano, mes, dia] = isoDate.split('-')
  if (!ano || !mes || !dia) return isoDate
  return `${dia}/${mes}/${ano}`
}

const NOMES_MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

// Soma dias a uma data "YYYY-MM-DD" usando aritmética em UTC (evita o
// mesmo problema de fuso horário que formatDateBR evita).
export function addDaysISO(isoDate: string, days: number): string {
  const [ano, mes, dia] = isoDate.split('-').map(Number)
  const data = new Date(Date.UTC(ano, mes - 1, dia))
  data.setUTCDate(data.getUTCDate() + days)
  const yyyy = data.getUTCFullYear()
  const mm = String(data.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(data.getUTCDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

// Recebe "YYYY-MM" e devolve "set/2026".
export function formatMonthLabel(yyyyMM: string): string {
  const [ano, mes] = yyyyMM.split('-')
  const nome = NOMES_MES[Number(mes) - 1]
  if (!nome || !ano) return yyyyMM
  return `${nome}/${ano}`
}
