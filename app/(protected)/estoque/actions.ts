'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { estoqueItemSchema, estoqueMovimentoSchema } from '@/lib/validations/estoque'

export type ActionState = { error?: string; success?: boolean } | undefined

export async function createEstoqueItem(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = estoqueItemSchema.safeParse({
    nome: formData.get('nome'),
    categoria: formData.get('categoria'),
    unidade_medida: formData.get('unidade_medida'),
    preco_corrente: formData.get('preco_corrente') || null,
    custo_unidade: formData.get('custo_unidade') || null,
    marca_fornecedor: formData.get('marca_fornecedor') || null,
    quantidade_atual: formData.get('quantidade_atual') || 0,
    quantidade_minima: formData.get('quantidade_minima') || 0,
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }

  const supabase = await createClient()
  const { error } = await supabase.from('estoque_itens').insert(parsed.data)
  if (error) return { error: error.message }

  revalidatePath('/estoque')
  return { success: true }
}

export async function updateEstoqueItem(
  id: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = estoqueItemSchema.safeParse({
    nome: formData.get('nome'),
    categoria: formData.get('categoria'),
    unidade_medida: formData.get('unidade_medida'),
    preco_corrente: formData.get('preco_corrente') || null,
    custo_unidade: formData.get('custo_unidade') || null,
    marca_fornecedor: formData.get('marca_fornecedor') || null,
    quantidade_atual: formData.get('quantidade_atual') || 0,
    quantidade_minima: formData.get('quantidade_minima') || 0,
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }

  // quantidade_atual não é gravada direto: ela é sempre derivada da soma dos
  // movimentos (trigger do banco, ver 0001_init.sql). Editar aqui registra
  // um movimento de ajuste com a diferença, em vez de sobrescrever o valor —
  // assim o histórico de movimentos continua batendo com o estoque atual.
  const { quantidade_atual: novaQuantidade, ...dadosItem } = parsed.data

  const supabase = await createClient()

  const { data: itemAtual, error: erroLeitura } = await supabase
    .from('estoque_itens')
    .select('quantidade_atual')
    .eq('id', id)
    .single()
  if (erroLeitura) return { error: erroLeitura.message }

  const { error } = await supabase.from('estoque_itens').update(dadosItem).eq('id', id)
  if (error) return { error: error.message }

  const diferenca = novaQuantidade - itemAtual.quantidade_atual
  if (diferenca !== 0) {
    const { error: erroMovimento } = await supabase.from('estoque_movimentos').insert({
      item_id: id,
      tipo: diferenca > 0 ? 'entrada' : 'saida',
      quantidade: Math.abs(diferenca),
      data: new Date().toISOString().slice(0, 10),
      motivo: 'Ajuste manual (edição do item de estoque)',
    })
    if (erroMovimento) return { error: erroMovimento.message }
  }

  revalidatePath('/estoque')
  revalidatePath(`/estoque/${id}`)
  return { success: true }
}

export async function deleteEstoqueItem(_id: string, _prevState: ActionState): Promise<ActionState> {
  const supabase = await createClient()
  const { error } = await supabase.from('estoque_itens').delete().eq('id', _id)
  if (error) return { error: error.message }
  revalidatePath('/estoque')
  return { success: true }
}

export async function registrarMovimento(
  itemId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = estoqueMovimentoSchema.safeParse({
    tipo: formData.get('tipo'),
    quantidade: formData.get('quantidade'),
    data: formData.get('data'),
    motivo: formData.get('motivo') || null,
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }

  const supabase = await createClient()
  const { error } = await supabase.from('estoque_movimentos').insert({ ...parsed.data, item_id: itemId })
  if (error) {
    if (error.message.includes('quantidade_atual')) {
      return { error: 'Estoque insuficiente para essa saída' }
    }
    return { error: error.message }
  }

  revalidatePath(`/estoque/${itemId}`)
  revalidatePath('/estoque')
  return { success: true }
}

export async function deleteMovimento(itemId: string, movimentoId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('estoque_movimentos').delete().eq('id', movimentoId)
  if (error) throw new Error(error.message)
  revalidatePath(`/estoque/${itemId}`)
  revalidatePath('/estoque')
}
