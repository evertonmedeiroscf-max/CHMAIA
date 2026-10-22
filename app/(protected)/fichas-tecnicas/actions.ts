'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { fichaTecnicaSchema } from '@/lib/validations/fichaTecnica'

export type ResultadoFicha = { error: string } | { id: string }

// Cria (id = null) ou atualiza uma ficha técnica de preparo e todas as linhas de
// ingredientes dela. O supabase-js não tem transação, então a ordem das
// gravações é pensada para nunca perder dados: grava/atualiza as linhas novas
// ANTES de apagar as que saíram da ficha.
export async function salvarFichaTecnica(id: string | null, dados: unknown): Promise<ResultadoFicha> {
  const parsed = fichaTecnicaSchema.safeParse(dados)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }

  const { ingredientes, ...cabecalho } = parsed.data
  const supabase = await createClient()

  let fichaId = id
  if (id) {
    const { data, error } = await supabase.from('fichas_tecnicas').update(cabecalho).eq('id', id).select('id').maybeSingle()
    if (error) return { error: error.message }
    if (!data) return { error: 'Ficha não encontrada (ela pode ter sido excluída).' }
  } else {
    const { data, error } = await supabase.from('fichas_tecnicas').insert(cabecalho).select('id').single()
    if (error || !data) return { error: error?.message ?? 'Não foi possível salvar a ficha.' }
    fichaId = data.id
  }
  if (!fichaId) return { error: 'Não foi possível salvar a ficha.' }

  // Só aceita ids de linha que realmente pertencem a ESTA ficha (um id de outra
  // ficha viraria "mover linha" por engano); qualquer outro vira linha nova.
  const { data: atuais } = await supabase.from('fichas_tecnicas_ingredientes').select('id').eq('ficha_id', fichaId)
  const idsAtuais = new Set((atuais ?? []).map((l) => l.id))

  const linhas = ingredientes.map((linha, i) => ({
    id: linha.id && idsAtuais.has(linha.id) ? linha.id : undefined,
    ficha_id: fichaId,
    ordem: i + 1,
    estoque_item_id: linha.estoque_item_id,
    observacao: linha.observacao,
    peso_liquido: linha.peso_liquido,
    fc: linha.fc,
    medida_caseira: linha.medida_caseira,
  }))
  const existentes = linhas.flatMap(({ id: linhaId, ...resto }) => (linhaId ? [{ id: linhaId, ...resto }] : []))
  const novas = linhas.flatMap(({ id: linhaId, ...resto }) => (linhaId ? [] : [resto]))

  const desfazerCriacao = async () => {
    if (!id) await supabase.from('fichas_tecnicas').delete().eq('id', fichaId)
  }

  if (existentes.length > 0) {
    const { error } = await supabase.from('fichas_tecnicas_ingredientes').upsert(existentes)
    if (error) {
      await desfazerCriacao()
      return { error: error.message }
    }
  }
  if (novas.length > 0) {
    const { error } = await supabase.from('fichas_tecnicas_ingredientes').insert(novas)
    if (error) {
      await desfazerCriacao()
      return { error: error.message }
    }
  }

  // Por último, tira as linhas que o usuário removeu da ficha.
  const idsMantidos = new Set(existentes.map((l) => l.id))
  const idsRemovidos = [...idsAtuais].filter((linhaId) => !idsMantidos.has(linhaId))
  if (idsRemovidos.length > 0) {
    const { error } = await supabase.from('fichas_tecnicas_ingredientes').delete().in('id', idsRemovidos)
    if (error) return { error: `Ficha salva, mas não consegui remover linhas antigas: ${error.message}` }
  }

  revalidatePath('/fichas-tecnicas')
  return { id: fichaId }
}

export async function excluirFichaTecnica(id: string): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('fichas_tecnicas').delete().eq('id', id).select('id')
  if (error) return { error: error.message }
  if (!data || data.length === 0) return { error: 'Ficha não encontrada ou sem permissão para excluir.' }

  revalidatePath('/fichas-tecnicas')
  return { success: true }
}
