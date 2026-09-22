import type { ItemOrcamento, SecaoOrcamento } from '@/lib/types/domain'

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

// Soma de todas as seções (comida + serviço) — é o "Total" antes dos
// extras, igual às planilhas de referência.
export function subtotalGeral(secoes: SecaoOrcamento[]): number {
  return secoes.reduce((soma, secao) => soma + subtotalSecao(secao).valor, 0)
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
