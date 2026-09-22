'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { produtoSchema } from '@/lib/validations/produtos'

export type ActionState = { error?: string; success?: boolean } | undefined

function parseFormData(formData: FormData) {
  return {
    nome: formData.get('nome'),
    tipo: formData.get('tipo'),
    categoria: formData.get('categoria') || null,
    peso_kg_padrao: formData.get('peso_kg_padrao') || null,
    valor_unit_padrao: formData.get('valor_unit_padrao'),
    ativo: formData.get('ativo') === 'S',
  }
}

export async function createProduto(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = produtoSchema.safeParse(parseFormData(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('produtos').insert(parsed.data)

  if (error) return { error: error.message }

  revalidatePath('/produtos')
  revalidatePath('/orcamentos')
  return { success: true }
}

export async function updateProduto(id: string, _prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = produtoSchema.safeParse(parseFormData(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('produtos').update(parsed.data).eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/produtos')
  revalidatePath('/orcamentos')
  return { success: true }
}

export async function deleteProduto(_id: string, _prevState: ActionState): Promise<ActionState> {
  const supabase = await createClient()
  const { error } = await supabase.from('produtos').delete().eq('id', _id)
  if (error) return { error: error.message }
  revalidatePath('/produtos')
  revalidatePath('/orcamentos')
  return { success: true }
}

export async function alternarAtivoProduto(id: string, ativo: boolean): Promise<ActionState> {
  const supabase = await createClient()
  const { error } = await supabase.from('produtos').update({ ativo }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/produtos')
  revalidatePath('/orcamentos')
  return { success: true }
}
