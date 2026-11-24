// Colunas do cabeçalho da tabela de ingredientes da ficha técnica que aceitam "lembrete"
// (nota amarela, como o comentário de célula do Excel). A `chave` é o que fica gravado em
// fichas_lembretes.coluna (tem a mesma lista na trava do banco, migração 0030).
export const COLUNAS_FICHA = [
  { chave: 'ingredientes', rotulo: 'Ingredientes' },
  { chave: 'observacoes', rotulo: 'Observações' },
  { chave: 'unid', rotulo: 'Unid' },
  { chave: 'peso_liquido', rotulo: 'Peso líquido' },
  { chave: 'fc', rotulo: 'FC' },
  { chave: 'peso_bruto', rotulo: 'Peso bruto' },
  { chave: 'medida_caseira', rotulo: 'Medida caseira' },
  { chave: 'preco_kg', rotulo: 'Preço do Kg' },
  { chave: 'preco_unit', rotulo: 'Preço unit' },
] as const

export type ChaveColunaFicha = (typeof COLUNAS_FICHA)[number]['chave']

// Um lembrete por coluna, igual para todas as fichas.
export type LembretesFicha = Partial<Record<ChaveColunaFicha, string>>

export const MAX_LEMBRETE = 500

export function chaveColunaValida(coluna: string): coluna is ChaveColunaFicha {
  return COLUNAS_FICHA.some((c) => c.chave === coluna)
}
