'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { pedidoSchema } from '@/lib/validations/pedidos'
import { FORMAS_PAGAMENTO, type FormaPagamento } from '@/lib/types/domain'

export type ActionState = { error?: string; success?: boolean } | undefined

function parseFormData(formData: FormData) {
  return {
    data_venda: formData.get('data_venda'),
    data_evento: formData.get('data_evento') || null,
    hora_evento: formData.get('hora_evento') || null,
    cliente: formData.get('cliente'),
    valor_total: formData.get('valor_total'),
    valor_pago: formData.get('valor_pago') || 0,
    entidade: formData.get('entidade'),
    emissao_nota: formData.get('emissao_nota') === 'S',
    forma_pagamento: formData.get('forma_pagamento') || null,
    banco: formData.get('banco') || null,
    data_pagamento: formData.get('data_pagamento') || null,
    status: formData.get('status'),
  }
}

export async function createPedido(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = pedidoSchema.safeParse(parseFormData(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('pedidos').insert(parsed.data)

  if (error) return { error: error.message }

  revalidatePath('/pedidos')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function updatePedido(
  id: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = pedidoSchema.safeParse(parseFormData(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('pedidos').update(parsed.data).eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/pedidos')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function updateFormaPagamentoPedido(id: string, forma_pagamento: FormaPagamento): Promise<ActionState> {
  if (!FORMAS_PAGAMENTO.includes(forma_pagamento)) {
    return { error: 'Forma de pagamento inválida' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('pedidos').update({ forma_pagamento }).eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/pedidos')
  revalidatePath('/dashboard')
  revalidatePath('/notas-fiscais')
  return { success: true }
}

export async function updateDataPagamentoPedido(id: string, data_pagamento: string | null): Promise<ActionState> {
  const supabase = await createClient()
  const { error } = await supabase.from('pedidos').update({ data_pagamento }).eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/pedidos')
  revalidatePath('/dashboard')
  revalidatePath('/notas-fiscais')
  return { success: true }
}

export async function deletePedido(_id: string, _prevState: ActionState): Promise<ActionState> {
  const supabase = await createClient()
  const { error } = await supabase.from('pedidos').delete().eq('id', _id)
  if (error) return { error: error.message }
  revalidatePath('/pedidos')
  revalidatePath('/dashboard')
  return { success: true }
}
