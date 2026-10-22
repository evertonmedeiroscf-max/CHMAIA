// Cálculos da FICHA TÉCNICA DE PREPARO - BASES, iguais aos da planilha (aba
// PADRÃO BASE):
//   Peso bruto  = Peso líquido x FC
//   Preço unit  = (Preço do Kg x FC) x Peso líquido
//   Custo total = soma dos "Preço unit"
//   Custo do kg = Custo total / Rendimento
// "Preço do Kg" é o Preço corrente do item no Estoque. Nada disso é gravado no
// banco: a ficha sempre recalcula, então acompanha os preços do Estoque.

export type LinhaCalculo = {
  peso_liquido: number
  fc: number
  // Preço corrente do item do Estoque; null = item sem preço cadastrado.
  preco_kg: number | null
}

export function pesoBruto(linha: Pick<LinhaCalculo, 'peso_liquido' | 'fc'>): number {
  return linha.peso_liquido * linha.fc
}

export function precoUnitario(linha: LinhaCalculo): number | null {
  if (linha.preco_kg === null) return null
  return linha.preco_kg * linha.fc * linha.peso_liquido
}

export type ResumoFicha = {
  custoTotal: number
  // null quando o rendimento não é maior que zero.
  custoKg: number | null
  // Ingredientes sem preço no Estoque: ficam fora da soma (custo parcial).
  semPreco: number
}

export function calcularFicha(linhas: LinhaCalculo[], rendimentoKg: number): ResumoFicha {
  let custoTotal = 0
  let semPreco = 0
  for (const linha of linhas) {
    const unit = precoUnitario(linha)
    if (unit === null) semPreco++
    else custoTotal += unit
  }
  return { custoTotal, custoKg: rendimentoKg > 0 ? custoTotal / rendimentoKg : null, semPreco }
}

// Número com casas fixas no formato brasileiro (ex.: 0,036 / 1,00).
export function formatNumero(valor: number, casas: number): string {
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })
}
