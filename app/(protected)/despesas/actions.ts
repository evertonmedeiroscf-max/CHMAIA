'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { despesaSchema } from '@/lib/validations/despesas'

export type ActionState = { error?: string; success?: boolean } | undefined

function parseFormData(formData: FormData) {
  return {
    data: formData.get('data'),
    categoria: formData.get('categoria'),
    descricao: formData.get('descricao'),
    valor: formData.get('valor'),
    forma_pagamento: formData.get('forma_pagamento') || null,
  }
}

export async function createDespesa(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = despesaSchema.safeParse(parseFormData(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('despesas').insert(parsed.data)

  if (error) return { error: error.message }

  revalidatePath('/despesas')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function updateDespesa(
  id: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = despesaSchema.safeParse(parseFormData(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('despesas').update(parsed.data).eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/despesas')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function deleteDespesa(_id: string, _prevState: ActionState): Promise<ActionState> {
  const supabase = await createClient()
  const { error } = await supabase.from('despesas').delete().eq('id', _id)
  if (error) return { error: error.message }
  revalidatePath('/despesas')
  revalidatePath('/dashboard')
  return { success: true }
}
