import type { createClient } from '@/lib/supabase/server'
import { pedidoSchema } from '@/lib/validations/pedidos'
import type { EntidadeTipo } from '@/lib/types/domain'

// Pedido gerado automaticamente a partir de um orçamento aprovado (ver
// updateOrcamento/createOrcamento em actions.ts). Não é arquivo 'use server'
// de propósito: são funções auxiliares, não ações chamáveis pela tela.

type Supabase = Awaited<ReturnType<typeof createClient>>

// entidade vem como texto do banco; pedidoSchema confere se é PF/PJ.
type DadosOrcamento = {
  cliente: string
  entidade: EntidadeTipo | string
  data_evento?: string | null
  hora_evento?: string | null
  valor_total: number
}

type Resultado = { error: string } | { ok: true; pedidoId?: string }

// Data de hoje no fuso de Natal (o servidor da Vercel roda em UTC).
function hojeNatal() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Fortaleza' })
}

// Cria o pedido seguindo as regras da aba Pedidos (pedidoSchema): valor
// maior que zero, status "pendente", nada pago, data da venda = dia da
// aprovação.
export async function criarPedidoDoOrcamento(supabase: Supabase, o: DadosOrcamento): Promise<Resultado> {
  if (!(Number(o.valor_total) > 0)) {
    return { error: 'Para aprovar, o orçamento precisa ter valor maior que R$ 0,00 — monte a planilha antes (a aba Pedidos exige valor).' }
  }
  const parsed = pedidoSchema.safeParse({
    data_venda: hojeNatal(),
    data_evento: o.data_evento ?? null,
    hora_evento: o.hora_evento ?? null,
    cliente: o.cliente,
    valor_total: o.valor_total,
    valor_pago: 0,
    entidade: o.entidade,
    emissao_nota: false,
    forma_pagamento: null,
    banco: null,
    data_pagamento: null,
    status: 'pendente',
  })
  if (!parsed.success) return { error: `Não foi possível gerar o pedido: ${parsed.error.issues[0]?.message ?? 'dados inválidos'}` }

  const { data, error } = await supabase.from('pedidos').insert(parsed.data).select('id').single()
  if (error || !data) return { error: `Não foi possível gerar o pedido: ${error?.message ?? 'erro desconhecido'}` }
  return { ok: true, pedidoId: data.id }
}

// Orçamento aprovado editado: leva cliente, evento, valor e PF/PJ para o
// pedido. Não mexe em pagamento/nota — só barra se o novo valor ficar
// abaixo do que já foi pago.
export async function sincronizarPedido(supabase: Supabase, pedidoId: string, o: DadosOrcamento): Promise<Resultado> {
  const { data: pedido } = await supabase.from('pedidos').select('numero, valor_pago').eq('id', pedidoId).maybeSingle()
  if (!pedido) return criarPedidoDoOrcamento(supabase, o)
  if (!(Number(o.valor_total) > 0)) {
    return { error: `O orçamento está aprovado (pedido nº ${pedido.numero}) e não pode ficar com valor R$ 0,00.` }
  }
  if (Number(pedido.valor_pago) > Number(o.valor_total)) {
    return { error: `O pedido nº ${pedido.numero} já tem pagamento maior que o novo valor do orçamento. Ajuste na aba Pedidos.` }
  }
  const { error } = await supabase
    .from('pedidos')
    .update({
      cliente: o.cliente,
      entidade: o.entidade,
      data_evento: o.data_evento ?? null,
      hora_evento: o.hora_evento ?? null,
      valor_total: o.valor_total,
    })
    .eq('id', pedidoId)
  if (error) return { error: `Não foi possível atualizar o pedido nº ${pedido.numero}: ${error.message}` }
  return { ok: true, pedidoId }
}

// Confere se o pedido pode ser retirado da aba Pedidos (orçamento recusado,
// voltou a pendente ou foi excluído): só se não tiver pagamento nem nota
// fiscal — excluir o pedido apagaria as notas junto (on delete cascade).
export async function verificarRetiradaPedido(supabase: Supabase, pedidoId: string): Promise<Resultado> {
  const { data: pedido } = await supabase.from('pedidos').select('numero, valor_pago').eq('id', pedidoId).maybeSingle()
  if (!pedido) return { ok: true }
  const { count } = await supabase
    .from('notas_fiscais')
    .select('id', { count: 'exact', head: true })
    .eq('pedido_id', pedidoId)
  if (Number(pedido.valor_pago) > 0 || (count ?? 0) > 0) {
    return {
      error: `O pedido nº ${pedido.numero} já tem pagamento ou nota fiscal registrados, então não pode ser retirado automaticamente. Resolva na aba Pedidos antes de mudar o status deste orçamento.`,
    }
  }
  return { ok: true }
}

export async function retirarPedido(supabase: Supabase, pedidoId: string): Promise<Resultado> {
  const { error } = await supabase.from('pedidos').delete().eq('id', pedidoId)
  if (error) return { error: `Não foi possível retirar o pedido da aba Pedidos: ${error.message}` }
  return { ok: true }
}
