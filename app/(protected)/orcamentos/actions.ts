'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { orcamentoSchema } from '@/lib/validations/orcamentos'
import { calcularResumo, calcularValidade } from '@/lib/utils/orcamento'
import type { SecaoOrcamento } from '@/lib/types/domain'
import { criarPedidoDoOrcamento, retirarPedido, sincronizarPedido, verificarRetiradaPedido } from './pedidoVinculado'

// `id` volta no create/update para a tela reabrir o orçamento salvo (e
// mostrar o botão "Gerar proposta").
export type ActionState = { error?: string; success?: boolean; id?: string } | undefined

function parseFormData(formData: FormData) {
  let itens: SecaoOrcamento[] = []
  const itensRaw = formData.get('itens')
  if (typeof itensRaw === 'string' && itensRaw) {
    try {
      // Linhas deixadas em branco na planilha (sem nome e sem valor) são
      // descartadas em vez de barrar o salvamento.
      itens = (JSON.parse(itensRaw) as SecaoOrcamento[]).map((secao) => ({
        ...secao,
        itens: secao.itens.filter((item) => item.nome.trim() || item.valor_unit),
      }))
    } catch {
      itens = []
    }
  }

  return {
    data_orcamento: formData.get('data_orcamento'),
    cliente: formData.get('cliente'),
    entidade: formData.get('entidade'),
    data_evento: formData.get('data_evento') || null,
    hora_evento: formData.get('hora_evento') || null,
    descricao: formData.get('descricao') || null,
    valor_total: formData.get('valor_total') || 0,
    // Nunca vem do formulário: é sempre 30 dias após a data do orçamento.
    validade: calcularValidade(String(formData.get('data_orcamento') ?? '')),
    status: formData.get('status'),
    numero_pessoas: formData.get('numero_pessoas') || null,
    percentual_extras: formData.get('percentual_extras') || 0,
    itens,
  }
}

// Quando há itens detalhados, o valor total nunca vem do que o usuário
// digitou (o campo fica só de leitura na tela) — é sempre o total da
// planilha, recalculado aqui a partir dos itens, pra não confiar em soma
// feita no cliente. Sem planilha, vale o valor digitado (pode ser 0).
function aplicarValorCalculado<T extends { itens: SecaoOrcamento[]; percentual_extras: number; valor_total: number }>(
  dados: T
): T {
  if (!dados.itens.length) return dados
  const { valorTotal } = calcularResumo(dados.itens, dados.percentual_extras, null)
  return { ...dados, valor_total: valorTotal }
}

function revalidarTudo() {
  revalidatePath('/orcamentos')
  revalidatePath('/pedidos')
  revalidatePath('/dashboard')
  revalidatePath('/resumo-anual')
}

// Orçamento aprovado entra sozinho na aba Pedidos (seguindo as regras de
// Pedidos — ver pedidoVinculado.ts); deixar de estar aprovado (recusado,
// pendente ou excluído) retira o pedido, desde que ele ainda não tenha
// pagamento nem nota fiscal.
export async function createOrcamento(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = orcamentoSchema.safeParse(parseFormData(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }
  }
  const dados = aplicarValorCalculado(parsed.data)
  const supabase = await createClient()

  let pedidoId: string | null = null
  if (dados.status === 'aprovado') {
    const r = await criarPedidoDoOrcamento(supabase, dados)
    if ('error' in r) return { error: r.error }
    pedidoId = r.pedidoId ?? null
  }

  const { data, error } = await supabase
    .from('orcamentos')
    .insert({ ...dados, pedido_id: pedidoId })
    .select('id')
    .single()

  if (error) {
    if (pedidoId) await retirarPedido(supabase, pedidoId)
    return { error: error.message }
  }

  revalidarTudo()
  return { success: true, id: data.id }
}

export async function updateOrcamento(
  id: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = orcamentoSchema.safeParse(parseFormData(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }
  }
  const dados = aplicarValorCalculado(parsed.data)
  const supabase = await createClient()

  const { data: atual, error: fetchError } = await supabase
    .from('orcamentos')
    .select('pedido_id, excluido_em')
    .eq('id', id)
    .single()
  if (fetchError || !atual) return { error: fetchError?.message ?? 'Orçamento não encontrado' }

  const aprovado = dados.status === 'aprovado' && !atual.excluido_em
  let pedidoId: string | null = atual.pedido_id
  let pedidoCriado: string | null = null
  let pedidoARetirar: string | null = null

  if (aprovado) {
    const r = pedidoId ? await sincronizarPedido(supabase, pedidoId, dados) : await criarPedidoDoOrcamento(supabase, dados)
    if ('error' in r) return { error: r.error }
    if (r.pedidoId && r.pedidoId !== pedidoId) pedidoCriado = r.pedidoId
    pedidoId = r.pedidoId ?? pedidoId
  } else if (pedidoId) {
    const r = await verificarRetiradaPedido(supabase, pedidoId)
    if ('error' in r) return { error: r.error }
    pedidoARetirar = pedidoId
    pedidoId = null
  }

  const { error } = await supabase
    .from('orcamentos')
    .update({ ...dados, pedido_id: pedidoId })
    .eq('id', id)

  if (error) {
    if (pedidoCriado) await retirarPedido(supabase, pedidoCriado)
    return { error: error.message }
  }

  if (pedidoARetirar) {
    const r = await retirarPedido(supabase, pedidoARetirar)
    if ('error' in r) {
      await supabase.from('orcamentos').update({ pedido_id: pedidoARetirar }).eq('id', id)
      return { error: r.error }
    }
  }

  revalidarTudo()
  return { success: true, id }
}

// Exclusão lógica: o orçamento continua na aba (realçado em vermelho) em
// vez de sumir — só marca excluido_em. restaurarOrcamento desfaz. Se ele
// estava aprovado, o pedido gerado sai da aba Pedidos (mesmas regras da
// recusa) e volta ao restaurar.
export async function deleteOrcamento(_id: string, _prevState: ActionState): Promise<ActionState> {
  const supabase = await createClient()
  const { data: atual } = await supabase.from('orcamentos').select('pedido_id').eq('id', _id).single()
  if (atual?.pedido_id) {
    const r = await verificarRetiradaPedido(supabase, atual.pedido_id)
    if ('error' in r) return { error: r.error }
  }
  const { error } = await supabase
    .from('orcamentos')
    .update({ excluido_em: new Date().toISOString(), pedido_id: null })
    .eq('id', _id)
  if (error) return { error: error.message }
  if (atual?.pedido_id) {
    const r = await retirarPedido(supabase, atual.pedido_id)
    if ('error' in r) {
      await supabase.from('orcamentos').update({ excluido_em: null, pedido_id: atual.pedido_id }).eq('id', _id)
      return { error: r.error }
    }
  }
  revalidarTudo()
  return { success: true }
}

export async function restaurarOrcamento(_id: string, _prevState: ActionState): Promise<ActionState> {
  const supabase = await createClient()
  const { data: o } = await supabase
    .from('orcamentos')
    .select('status, pedido_id, cliente, entidade, data_evento, hora_evento, valor_total')
    .eq('id', _id)
    .single()
  let pedidoId: string | null = o?.pedido_id ?? null
  if (o && o.status === 'aprovado' && !pedidoId) {
    const r = await criarPedidoDoOrcamento(supabase, { ...o, valor_total: Number(o.valor_total) })
    if ('error' in r) return { error: r.error }
    pedidoId = r.pedidoId ?? null
  }
  const { error } = await supabase.from('orcamentos').update({ excluido_em: null, pedido_id: pedidoId }).eq('id', _id)
  if (error) {
    if (pedidoId && pedidoId !== o?.pedido_id) await retirarPedido(supabase, pedidoId)
    return { error: error.message }
  }
  revalidarTudo()
  return { success: true }
}

// Cria um Pedido a partir de um orçamento já aprovado e grava o vínculo em
// pedido_id, pra não dar pra converter o mesmo orçamento duas vezes. Exige
// que o usuário também tenha acesso à aba Pedidos (RLS de pedidos) — sem
// isso, o insert falha e a mensagem de erro do Supabase é repassada.
export async function converterEmPedido(orcamentoId: string): Promise<ActionState> {
  const supabase = await createClient()

  const { data: orcamento, error: fetchError } = await supabase
    .from('orcamentos')
    .select('*')
    .eq('id', orcamentoId)
    .single()

  if (fetchError || !orcamento) return { error: fetchError?.message ?? 'Orçamento não encontrado' }
  if (orcamento.pedido_id) return { error: 'Este orçamento já foi convertido em pedido' }
  if (orcamento.excluido_em) return { error: 'Orçamento excluído — restaure antes de converter em pedido' }
  if (!(Number(orcamento.valor_total) > 0)) {
    return { error: 'Orçamento com valor R$ 0,00 — monte a planilha (ou informe o valor) antes de converter em pedido' }
  }

  const hoje = new Date().toISOString().slice(0, 10)
  const { data: pedido, error: insertError } = await supabase
    .from('pedidos')
    .insert({
      data_venda: hoje,
      data_evento: orcamento.data_evento,
      hora_evento: orcamento.hora_evento,
      cliente: orcamento.cliente,
      valor_total: orcamento.valor_total,
      valor_pago: 0,
      entidade: orcamento.entidade,
      emissao_nota: false,
      status: 'pendente',
    })
    .select('id')
    .single()

  if (insertError || !pedido) return { error: insertError?.message ?? 'Falha ao criar o pedido' }

  const { error: updateError } = await supabase
    .from('orcamentos')
    .update({ pedido_id: pedido.id, status: 'aprovado' })
    .eq('id', orcamentoId)

  if (updateError) return { error: updateError.message }

  revalidatePath('/orcamentos')
  revalidatePath('/pedidos')
  revalidatePath('/dashboard')
  return { success: true }
}
