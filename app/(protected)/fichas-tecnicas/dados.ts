import type { createClient } from '@/lib/supabase/server'
import type { FichaTecnica, FichaTecnicaIngrediente, ItemEstoqueFicha } from '@/lib/types/domain'
import { calcularTodasAsFichas, type ResumoFicha } from '@/lib/utils/fichaTecnica'
import { chaveColunaValida, type LembretesFicha } from '@/lib/utils/lembretesFicha'
import { posicaoValida, type FotoFicha } from '@/lib/utils/fichaFotos'

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
    const { data, error } = await supabase
      .from('estoque_itens')
      .select('id, nome, categoria, unidade_medida, preco_corrente')
      .order('nome')
      .order('id')
      .range(inicio, inicio + TAMANHO_PAGINA - 1)
    if (error) throw new Error(error.message)
    const pagina = (data ?? []) as ItemEstoqueFicha[]
    itens.push(...pagina)
    if (pagina.length < TAMANHO_PAGINA) break
  }
  return itens
}

export async function carregarFichas(supabase: Supabase): Promise<FichaTecnica[]> {
  const fichas: FichaTecnica[] = []
  for (let inicio = 0; ; inicio += TAMANHO_PAGINA) {
    const { data, error } = await supabase
      .from('fichas_tecnicas')
      .select('*')
      .order('id')
      .range(inicio, inicio + TAMANHO_PAGINA - 1)
    if (error) throw new Error(error.message)
    const pagina = (data ?? []) as FichaTecnica[]
    fichas.push(...pagina)
    if (pagina.length < TAMANHO_PAGINA) break
  }
  return fichas
}

// Todas as linhas de ingredientes de todas as fichas, já na ordem de cada ficha.
export async function carregarLinhas(supabase: Supabase): Promise<FichaTecnicaIngrediente[]> {
  const linhas: FichaTecnicaIngrediente[] = []
  for (let inicio = 0; ; inicio += TAMANHO_PAGINA) {
    const { data, error } = await supabase
      .from('fichas_tecnicas_ingredientes')
      .select('*')
      .order('id')
      .range(inicio, inicio + TAMANHO_PAGINA - 1)
    if (error) throw new Error(error.message)
    const pagina = (data ?? []) as FichaTecnicaIngrediente[]
    linhas.push(...pagina)
    if (pagina.length < TAMANHO_PAGINA) break
  }
  return linhas.sort((a, b) => a.ficha_id.localeCompare(b.ficha_id) || a.ordem - b.ordem)
}

// Lembretes (notas amarelas) dos cabeçalhos da tabela de ingredientes: um por coluna.
export async function carregarLembretes(supabase: Supabase): Promise<LembretesFicha> {
  const { data } = await supabase.from('fichas_lembretes').select('coluna, texto')
  const lembretes: LembretesFicha = {}
  for (const l of data ?? []) if (chaveColunaValida(l.coluna)) lembretes[l.coluna] = l.texto
  return lembretes
}

// Por quanto tempo vale o link temporário das fotos (6 h): dá folga para deixar a ficha aberta e
// imprimir depois. O arquivo em si continua privado.
const VALIDADE_LINK_FOTO_SEGUNDOS = 6 * 60 * 60

// Fotos da ficha (produto finalizado e passo a passo), cada uma com seu link temporário.
// Foto cujo link não pôde ser gerado vem com `url: null` (a tela avisa, e dá para excluir).
export async function carregarFotosFicha(supabase: Supabase, fichaId: string): Promise<FotoFicha[]> {
  const { data, error } = await supabase
    .from('fichas_fotos')
    .select('id, posicao, ordem, legenda, arquivo_path')
    .eq('ficha_id', fichaId)
    .order('ordem', { ascending: true })
    .order('created_at', { ascending: true })
  if (error || !data || data.length === 0) return []

  const { data: links } = await supabase.storage.from('fichas-fotos').createSignedUrls(
    data.map((f) => f.arquivo_path),
    VALIDADE_LINK_FOTO_SEGUNDOS
  )
  const urlPorCaminho = new Map((links ?? []).map((l) => [l.path, l.error ? null : l.signedUrl]))

  return data.flatMap((f) =>
    posicaoValida(f.posicao)
      ? [{ id: f.id, posicao: f.posicao, ordem: f.ordem, legenda: f.legenda, url: urlPorCaminho.get(f.arquivo_path) ?? null }]
      : []
  )
}

export type DadosFichas = {
  fichas: FichaTecnica[]
  linhas: FichaTecnicaIngrediente[]
  itens: ItemEstoqueFicha[]
  // Custos de TODAS as fichas (inclui o vínculo Finalização -> Base), por id.
  resumos: Map<string, ResumoFicha>
}

export async function carregarDadosFichas(supabase: Supabase): Promise<DadosFichas> {
  const [fichas, linhas, itens] = await Promise.all([carregarFichas(supabase), carregarLinhas(supabase), carregarItensEstoque(supabase)])
  const precoPorItem = new Map(itens.map((i) => [i.id, i.preco_corrente]))
  const resumos = calcularTodasAsFichas(fichas, linhas, precoPorItem)
  return { fichas, linhas, itens, resumos }
}
