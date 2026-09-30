'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { confirmarItemNotaCompraSchema } from '@/lib/validations/notaCompra'
import { normalizarTextoNota } from '@/lib/utils/notaCompra'

export type ActionState = { error?: string; success?: boolean } | undefined

// Confirma UM item da nota: cria o movimento de entrada de verdade (é isso
// que soma em estoque_itens.quantidade_atual, via o trigger que já existe),
// marca o item como validado, e aprende o apelido pra próxima nota do mesmo
// fornecedor. Nunca usa uma function/RPC do banco — a trava real contra
// confirmar o mesmo item duas vezes é o índice único parcial em
// estoque_movimentos.nota_item_id (ver 0024_notas_compra.sql), então mesmo
// um duplo-clique não duplica o lançamento.
export async function confirmarItemNotaCompra(
  itemId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = confirmarItemNotaCompraSchema.safeParse({
    estoque_item_id: formData.get('estoque_item_id'),
    quantidade: formData.get('quantidade'),
    valor_total: formData.get('valor_total'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }

  const supabase = await createClient()

  const { data: item, error: erroItem } = await supabase
    .from('notas_compra_itens')
    .select('*')
    .eq('id', itemId)
    .single()
  if (erroItem || !item) return { error: 'Item não encontrado' }
  if (item.validado) return { error: 'Este item já foi confirmado' }

  const { data: nota } = await supabase
    .from('notas_compra')
    .select('estabelecimento, data_compra')
    .eq('id', item.nota_id)
    .single()

  const { error: erroMovimento } = await supabase.from('estoque_movimentos').insert({
    item_id: parsed.data.estoque_item_id,
    tipo: 'entrada',
    quantidade: parsed.data.quantidade,
    data: nota?.data_compra ?? new Date().toISOString().slice(0, 10),
    motivo: `Compra${nota?.estabelecimento ? ` — ${nota.estabelecimento}` : ''}`,
    nota_item_id: itemId,
  })
  if (erroMovimento) {
    if (erroMovimento.code === '23505') return { error: 'Este item já foi confirmado' }
    if (erroMovimento.message.includes('quantidade')) return { error: 'Quantidade inválida' }
    return { error: erroMovimento.message }
  }

  const { error: erroAtualizarItem } = await supabase
    .from('notas_compra_itens')
    .update({
      estoque_item_id: parsed.data.estoque_item_id,
      quantidade: parsed.data.quantidade,
      valor_total: parsed.data.valor_total,
      validado: true,
    })
    .eq('id', itemId)
  if (erroAtualizarItem) return { error: erroAtualizarItem.message }

  await supabase
    .from('estoque_apelidos')
    .upsert(
      { estoque_item_id: parsed.data.estoque_item_id, texto_normalizado: normalizarTextoNota(item.texto_original) },
      { onConflict: 'texto_normalizado' }
    )

  const { count } = await supabase
    .from('notas_compra_itens')
    .select('id', { count: 'exact', head: true })
    .eq('nota_id', item.nota_id)
    .eq('validado', false)
  if (count === 0) {
    await supabase.from('notas_compra').update({ status: 'concluida' }).eq('id', item.nota_id)
  }

  revalidatePath('/estoque/notas-compra')
  revalidatePath(`/estoque/notas-compra/${item.nota_id}`)
  revalidatePath('/estoque')
  revalidatePath(`/estoque/${parsed.data.estoque_item_id}`)
  return { success: true }
}
