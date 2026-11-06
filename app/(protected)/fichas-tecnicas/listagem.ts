import type { TipoFicha } from '@/lib/types/domain'

// Ficha já com os custos calculados (a partir dos preços atuais do Estoque e,
// na Finalização, do custo/kg da Base), pronta para o índice e a tabela.
export type FichaListada = {
  id: string
  nome: string
  tipo: TipoFicha
  rendimento_kg: number | null
  data_atualizacao: string | null
  ingredientes: number
  // BASE: custo total da receita. FINALIZAÇÃO: custo do prato.
  custo_total: number
  custo_kg: number | null
  // Linhas que ficaram fora do custo (sem ingrediente, preço, peso ou FC).
  incompletas: number
  // Linhas que a importação não conseguiu associar com clareza.
  sem_origem: number
}
