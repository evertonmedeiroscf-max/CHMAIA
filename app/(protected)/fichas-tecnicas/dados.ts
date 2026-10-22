import type { createClient } from '@/lib/supabase/server'
import type { ItemEstoqueFicha } from '@/lib/types/domain'

type Supabase = Awaited<ReturnType<typeof createClient>>

// O Supabase devolve no máximo 1.000 linhas por consulta. Sem paginar, uma
// lista maior seria cortada em silêncio — e aqui isso significaria custos
// errados nas fichas. Por isso a leitura vai em páginas até acabar.
const TAMANHO_PAGINA = 1000

// Itens do Estoque que a ficha pode usar como ingrediente (só o que a ficha
// precisa: nome, categoria, unidade e preço corrente = "Preço do Kg").
export async function carregarItensEstoque(supabase: Supabase): Promise<ItemEstoqueFicha[]> {
  const itens: ItemEstoqueFicha[] = []
  for (let inicio = 0; ; inicio += TAMANHO_PAGINA) {
    const { data } = await supabase
      .from('estoque_itens')
      .select('id, nome, categoria, unidade_medida, preco_corrente')
      .order('nome')
      .order('id')
      .range(inicio, inicio + TAMANHO_PAGINA - 1)
    const pagina = (data ?? []) as ItemEstoqueFicha[]
    itens.push(...pagina)
    if (pagina.length < TAMANHO_PAGINA) break
  }
  return itens
}

export type LinhaResumo = { ficha_id: string; estoque_item_id: string; peso_liquido: number; fc: number }

// Todas as linhas de ingredientes de todas as fichas (para o custo da lista).
export async function carregarLinhasIngredientes(supabase: Supabase): Promise<LinhaResumo[]> {
  const linhas: LinhaResumo[] = []
  for (let inicio = 0; ; inicio += TAMANHO_PAGINA) {
    const { data } = await supabase
      .from('fichas_tecnicas_ingredientes')
      .select('ficha_id, estoque_item_id, peso_liquido, fc')
      .order('id')
      .range(inicio, inicio + TAMANHO_PAGINA - 1)
    const pagina = (data ?? []) as LinhaResumo[]
    linhas.push(...pagina)
    if (pagina.length < TAMANHO_PAGINA) break
  }
  return linhas
}
