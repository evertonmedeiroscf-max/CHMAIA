import type { TipoFicha } from '@/lib/types/domain'

// Cálculos das FICHAS TÉCNICAS DE PREPARO, iguais aos da planilha (abas PADRÃO
// BASE e PADRÃO FINALIZAÇÃO):
//   Peso bruto  = Peso líquido x FC
//   Preço unit  = (Preço do Kg x FC) x Peso líquido
//   BASE:        Custo total = soma dos "Preço unit"; Custo do kg = Custo total / Rendimento
//   FINALIZAÇÃO: Custo do prato = soma dos "Preço unit"; Preço sugerido = Custo do prato x Markup;
//                Peso aproximado = soma dos pesos líquidos; Peso per capita = Peso aproximado / Serve
// "Preço do Kg" é o Preço corrente do item do Estoque ou, quando o ingrediente é
// outra ficha (a Base do produto), o custo do kg dela. Nada disso é gravado: a
// ficha sempre recalcula, então acompanha os preços do Estoque.
//
// Dado que falta (peso, FC, preço, ingrediente sem origem) NUNCA é assumido: a
// linha fica fora da soma e é contada em `incompletas` para a tela avisar.

export type LinhaCalculo = {
  peso_liquido: number | null
  fc: number | null
  // Preço corrente do item do Estoque, ou custo/kg da ficha de Base; null = não há.
  preco_kg: number | null
  // O preço veio de uma ficha de Base que ela mesma tem linhas incompletas
  // (o custo da Base é parcial, então o desta linha também é).
  parcial?: boolean
}

export function pesoBruto(linha: Pick<LinhaCalculo, 'peso_liquido' | 'fc'>): number | null {
  if (linha.peso_liquido === null || linha.fc === null) return null
  return linha.peso_liquido * linha.fc
}

export function precoUnitario(linha: LinhaCalculo): number | null {
  if (linha.preco_kg === null || linha.peso_liquido === null || linha.fc === null) return null
  return linha.preco_kg * linha.fc * linha.peso_liquido
}

export type ResumoFicha = {
  // BASE: custo total da receita. FINALIZAÇÃO: custo do prato.
  custoTotal: number
  // BASE: custo total / rendimento (null sem rendimento).
  custoKg: number | null
  // FINALIZAÇÃO
  pesoAproximado: number
  precoSugerido: number | null
  pesoPerCapita: number | null
  // Linhas que ficaram fora da soma (ou cujo custo é parcial): o total é parcial.
  incompletas: number
}

export type OpcoesFicha = {
  rendimentoKg?: number | null
  markup?: number | null
  serve?: number | null
}

export function calcularFicha(linhas: LinhaCalculo[], opcoes: OpcoesFicha = {}): ResumoFicha {
  let custoTotal = 0
  let pesoAproximado = 0
  let incompletas = 0
  for (const linha of linhas) {
    const unit = precoUnitario(linha)
    if (unit === null) incompletas++
    else {
      custoTotal += unit
      if (linha.parcial) incompletas++
    }
    if (linha.peso_liquido !== null) pesoAproximado += linha.peso_liquido
  }
  const { rendimentoKg = null, markup = null, serve = null } = opcoes
  return {
    custoTotal,
    custoKg: rendimentoKg !== null && rendimentoKg > 0 ? custoTotal / rendimentoKg : null,
    pesoAproximado,
    precoSugerido: markup !== null ? custoTotal * markup : null,
    pesoPerCapita: serve !== null && serve > 0 ? pesoAproximado / serve : null,
    incompletas,
  }
}

export type FichaParaCusto = {
  id: string
  tipo: TipoFicha
  rendimento_kg: number | null
  markup: number | null
  serve: number | null
}

export type LinhaParaCusto = {
  ficha_id: string
  estoque_item_id: string | null
  ficha_ingrediente_id: string | null
  sem_origem: boolean
  peso_liquido: number | null
  fc: number | null
}

// Resumo de TODAS as fichas de uma vez. Uma linha pode ser outra ficha (a Base
// do produto): o custo dela é o custo/kg da Base, calculado primeiro (memoizado).
// Ciclo entre fichas (A usa B e B usa A) não é possível salvar, mas se existir
// no banco a linha do ciclo simplesmente fica sem preço em vez de travar.
export function calcularTodasAsFichas(
  fichas: FichaParaCusto[],
  linhas: LinhaParaCusto[],
  precoPorItem: Map<string, number | null>
): Map<string, ResumoFicha> {
  const porId = new Map(fichas.map((f) => [f.id, f]))
  const linhasPorFicha = new Map<string, LinhaParaCusto[]>()
  for (const linha of linhas) {
    const lista = linhasPorFicha.get(linha.ficha_id) ?? []
    lista.push(linha)
    linhasPorFicha.set(linha.ficha_id, lista)
  }

  const memo = new Map<string, ResumoFicha>()
  const emCalculo = new Set<string>()

  function resumoDe(id: string): ResumoFicha | null {
    const pronto = memo.get(id)
    if (pronto) return pronto
    const ficha = porId.get(id)
    if (!ficha || emCalculo.has(id)) return null
    emCalculo.add(id)
    const linhasCalculo: LinhaCalculo[] = (linhasPorFicha.get(id) ?? []).map((l) => {
      let preco: number | null = null
      let parcial = false
      if (!l.sem_origem && l.estoque_item_id) {
        preco = precoPorItem.get(l.estoque_item_id) ?? null
      } else if (!l.sem_origem && l.ficha_ingrediente_id) {
        const base = resumoDe(l.ficha_ingrediente_id)
        preco = base?.custoKg ?? null
        parcial = !!base && base.incompletas > 0
      }
      return { peso_liquido: l.peso_liquido, fc: l.fc, preco_kg: preco, parcial }
    })
    emCalculo.delete(id)
    const resumo = calcularFicha(linhasCalculo, { rendimentoKg: ficha.rendimento_kg, markup: ficha.markup, serve: ficha.serve })
    memo.set(id, resumo)
    return resumo
  }

  const todos = new Map<string, ResumoFicha>()
  for (const f of fichas) {
    const r = resumoDe(f.id)
    if (r) todos.set(f.id, r)
  }
  return todos
}

// Número com casas fixas no formato brasileiro (ex.: 0,036 / 1,00).
export function formatNumero(valor: number, casas: number): string {
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })
}
