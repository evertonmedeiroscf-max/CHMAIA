'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { notaFiscalCreateSchema, notaFiscalUpdateSchema } from '@/lib/validations/notas-fiscais'

export type ActionState = { error?: string; success?: boolean } | undefined

// Cria manualmente uma nota para um pedido que ainda não tem uma ativa
// (caso de exceção — o normal é a nota nascer sozinha quando "emissão de
// nota" é marcada como Sim no pedido). Venda/valor/pago/forma/banco/dt pg
// são sempre copiados do pedido no momento da criação, nunca digitados
// aqui — só número da nota e data de emissão são inputs do usuário.
export async function createNotaFiscal(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = notaFiscalCreateSchema.safeParse({
    pedido_id: formData.get('pedido_id'),
    numero_nota: formData.get('numero_nota') || null,
    data_emissao: formData.get('data_emissao') || null,
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }
  }

  const supabase = await createClient()

  const { data: pedido, error: pedidoError } = await supabase
    .from('pedidos')
    .select('*')
    .eq('id', parsed.data.pedido_id)
    .single()
  if (pedidoError || !pedido) {
    return { error: pedidoError?.message ?? 'Venda não encontrada' }
  }

  const { error } = await supabase.from('notas_fiscais').insert({
    pedido_id: parsed.data.pedido_id,
    numero_nota: parsed.data.numero_nota,
    data_emissao: parsed.data.data_emissao,
    valor: pedido.valor_total,
    valor_pago: pedido.valor_pago,
    pago: pedido.status === 'pago',
    forma_pagamento: pedido.forma_pagamento,
    banco: pedido.banco,
    data_pagamento: pedido.data_pagamento,
  })

  if (error) return { error: error.message }

  revalidatePath('/notas-fiscais')
  return { success: true }
}

// Edição fica restrita a número da nota, data de emissão e cancelamento
// manual. Venda/valor/pago/forma/banco/dt pg só mudam editando o pedido.
export async function updateNotaFiscal(
  id: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = notaFiscalUpdateSchema.safeParse({
    numero_nota: formData.get('numero_nota') || null,
    data_emissao: formData.get('data_emissao') || null,
    cancelada: formData.get('cancelada') === 'S',
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('notas_fiscais').update(parsed.data).eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/notas-fiscais')
  return { success: true }
}

export async function deleteNotaFiscal(_id: string, _prevState: ActionState): Promise<ActionState> {
  const supabase = await createClient()
  const { error } = await supabase.from('notas_fiscais').delete().eq('id', _id)
  if (error) return { error: error.message }
  revalidatePath('/notas-fiscais')
  return { success: true }
}
