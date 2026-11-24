'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { listarCategoriasEstoque, resolverCategoria } from '@/lib/utils/categoriasEstoque'
import { estoqueItemSchema, estoqueMovimentoSchema } from '@/lib/validations/estoque'

export type ActionState = { error?: string; success?: boolean } | undefined

// A categoria pode ser nova (digitada no formulário). Se ela for igual — ignorando acento e
// maiúsculas — a uma que já existe, usa a grafia que já existe, para não nascer "bebidas"
// ao lado de "Bebidas". Se a consulta falhar, segue com o que foi digitado.
async function categoriaCanonica(supabase: Awaited<ReturnType<typeof createClient>>, digitada: string): Promise<string> {
  const emUso: string[] = []
  for (let inicio = 0; ; inicio += 1000) {
    const { data, error } = await supabase.from('estoque_itens').select('categoria').order('id').range(inicio, inicio + 999)
    if (error || !data) break
    emUso.push(...data.map((d) => d.categoria))
    if (data.length < 1000) break
  }
  return resolverCategoria(digitada, listarCategoriasEstoque(emUso))
}

export async function createEstoqueItem(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = estoqueItemSchema.safeParse({
    nome: formData.get('nome'),
    categoria: formData.get('categoria'),
    unidade_medida: formData.get('unidade_medida'),
    preco_corrente: formData.get('preco_corrente') || null,
    fc: formData.get('fc') || null,
    custo_unidade: formData.get('custo_unidade') || null,
    observacao: formData.get('observacao') || null,
    marca_fornecedor: formData.get('marca_fornecedor') || null,
    quantidade_atual: formData.get('quantidade_atual') || 0,
    quantidade_minima: formData.get('quantidade_minima') || 0,
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }

  const supabase = await createClient()
  const categoria = await categoriaCanonica(supabase, parsed.data.categoria)
  const { error } = await supabase.from('estoque_itens').insert({ ...parsed.data, categoria })
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
    fc: formData.get('fc') || null,
    custo_unidade: formData.get('custo_unidade') || null,
    observacao: formData.get('observacao') || null,
    marca_fornecedor: formData.get('marca_fornecedor') || null,
    quantidade_atual: formData.get('quantidade_atual') || 0,
    quantidade_minima: formData.get('quantidade_minima') || 0,
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }

  // quantidade_atual não é gravada direto: ela é sempre derivada da soma dos
  // movimentos (trigger do banco, ver 0001_init.sql). Editar aqui registra
  // um movimento de ajuste com a diferença, em vez de sobrescrever o valor —
  // assim o histórico de movimentos continua batendo com o estoque atual.
  const { quantidade_atual: novaQuantidade, ...dadosBrutos } = parsed.data

  const supabase = await createClient()
  const dadosItem = { ...dadosBrutos, categoria: await categoriaCanonica(supabase, dadosBrutos.categoria) }

  const { data: itemAtual, error: erroLeitura } = await supabase
    .from('estoque_itens')
    .select('quantidade_atual')
    .eq('id', id)
    .single()
  if (erroLeitura) return { error: erroLeitura.message }

  // Preencher o FC à mão resolve a marca "não obteve do arquivo de origem" da
  // importação — o item deixa de ser realçado.
  const atualizacao = dadosItem.fc != null ? { ...dadosItem, fc_sem_origem: false } : dadosItem
  const { error } = await supabase.from('estoque_itens').update(atualizacao).eq('id', id)
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
  if (error) {
    // O item está como ingrediente em alguma ficha técnica (FK "restrict").
    if (error.message.includes('fichas_tecnicas_ingredientes')) {
      return { error: 'Este item é usado como ingrediente em fichas técnicas e não pode ser excluído. Tire-o das fichas antes.' }
    }
    return { error: error.message }
  }
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

  const { data: movimento } = await supabase
    .from('estoque_movimentos')
    .select('nota_item_id')
    .eq('id', movimentoId)
    .single()

  const { error } = await supabase.from('estoque_movimentos').delete().eq('id', movimentoId)
  if (error) throw new Error(error.message)

  // Esse movimento veio da confirmação de um item de nota de compra — sem
  // isso, a nota ficava marcada como concluída pra sempre com um movimento
  // que não existe mais, e o item sumia da tela de conferência.
  if (movimento?.nota_item_id) {
    const { data: item } = await supabase
      .from('notas_compra_itens')
      .select('nota_id')
      .eq('id', movimento.nota_item_id)
      .single()
    await supabase
      .from('notas_compra_itens')
      .update({ validado: false, estoque_item_id: null })
      .eq('id', movimento.nota_item_id)
    if (item) {
      await supabase.from('notas_compra').update({ status: 'aprovada' }).eq('id', item.nota_id).eq('status', 'concluida')
      revalidatePath('/estoque/notas-compra')
      revalidatePath(`/estoque/notas-compra/${item.nota_id}`)
    }
  }

  revalidatePath(`/estoque/${itemId}`)
  revalidatePath('/estoque')
}
