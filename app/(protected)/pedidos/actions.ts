'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { pedidoSchema } from '@/lib/validations/pedidos'
import { FORMAS_PAGAMENTO, type FormaPagamento } from '@/lib/types/domain'
import {
  excluirEventoPedido,
  googleAgendaConfigurada,
  sincronizarEventoPedido,
  sincronizarPedidosEmLote,
} from '@/lib/google/calendar'

export type ActionState = { error?: string; success?: boolean } | undefined

// Contagem de um envio em lote à Google Agenda (soma-se uma por lote enviado).
export type ResumoSincronizacaoGoogle = {
  criados: number
  atualizados: number
  removidos: number
  falhas: number
  primeiroErro?: string
}

export type PreparoSincronizacaoGoogle = { error: string } | { ids: string[]; ignorados: number }
export type ResultadoLoteSincronizacaoGoogle = { error: string } | { resumo: ResumoSincronizacaoGoogle }

const ERRO_GOOGLE_NAO_CONFIGURADA =
  'A integração com a Google Agenda ainda não está configurada neste ambiente (faltam as variáveis GOOGLE_APPS_SCRIPT_URL e GOOGLE_APPS_SCRIPT_TOKEN, ou as três GOOGLE_CALENDAR_*).'

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
  const { data, error } = await supabase.from('pedidos').insert(parsed.data).select().single()

  if (error) return { error: error.message }

  // Cria o evento na Google Agenda (se a integração estiver configurada e o
  // pedido tiver data/hora de evento) e grava o id retornado — falha aqui
  // nunca impede o pedido de ser salvo (ver lib/google/calendar.ts).
  const eventoId = await sincronizarEventoPedido(data, null)
  if (eventoId) {
    await supabase.from('pedidos').update({ google_calendar_event_id: eventoId }).eq('id', data.id)
  }

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
  const { data, error } = await supabase.from('pedidos').update(parsed.data).eq('id', id).select().single()

  if (error) return { error: error.message }

  // Mantém o evento da Google Agenda em dia: atualiza se a data/hora do
  // evento mudou, cria se não existia um ainda, ou apaga se o evento foi
  // removido do pedido (ver sincronizarEventoPedido).
  const eventoIdAnterior = data.google_calendar_event_id
  const eventoId = await sincronizarEventoPedido(data, eventoIdAnterior)
  if (eventoId !== eventoIdAnterior) {
    await supabase.from('pedidos').update({ google_calendar_event_id: eventoId }).eq('id', id)
  }

  revalidatePath('/pedidos')
  revalidatePath('/dashboard')
  return { success: true }
}

// Botão "Sincronizar com Google Agenda" do Calendário, passo 1: descobre quais
// pedidos entram no envio — todos os que têm data e hora de evento (inclusive
// os anteriores à integração) e os sem data/hora que ainda têm um evento antigo
// no Google (esse evento é removido, igual acontece ao editar o pedido). A tela
// então manda os ids em lotes pequenos pra `sincronizarLotePedidosGoogle`.
export async function prepararSincronizacaoGoogle(): Promise<PreparoSincronizacaoGoogle> {
  if (!googleAgendaConfigurada()) return { error: ERRO_GOOGLE_NAO_CONFIGURADA }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('pedidos')
    .select('id, data_evento, hora_evento, google_calendar_event_id')
    .order('data_venda')
  if (error) return { error: error.message }

  const pedidos = data ?? []
  const ids = pedidos.filter((p) => (p.data_evento && p.hora_evento) || p.google_calendar_event_id).map((p) => p.id)
  return { ids, ignorados: pedidos.length - ids.length }
}

// Passo 2: envia um lote de pedidos (poucos por vez, pra cada chamada ficar bem
// abaixo do tempo limite do servidor). Quem já tem evento é só atualizado, então
// repetir o envio nunca duplica nada.
export async function sincronizarLotePedidosGoogle(ids: string[]): Promise<ResultadoLoteSincronizacaoGoogle> {
  if (!googleAgendaConfigurada()) return { error: ERRO_GOOGLE_NAO_CONFIGURADA }
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 25 || ids.some((id) => typeof id !== 'string')) {
    return { error: 'Lote de pedidos inválido.' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.from('pedidos').select('*').in('id', ids)
  if (error) return { error: error.message }

  // Pedido excluído no meio do caminho simplesmente não vem na consulta.
  const pedidos = data ?? []
  const resultados = await sincronizarPedidosEmLote(
    pedidos.map((pedido) => ({ pedido, eventoIdExistente: pedido.google_calendar_event_id }))
  )

  const resumo: ResumoSincronizacaoGoogle = { criados: 0, atualizados: 0, removidos: 0, falhas: 0 }
  const registrarFalha = (mensagem: string) => {
    resumo.falhas++
    resumo.primeiroErro ??= mensagem
  }

  for (let i = 0; i < pedidos.length; i++) {
    const pedido = pedidos[i]
    const resultado = resultados[i]
    if (!resultado.ok) {
      registrarFalha(`Pedido #${pedido.numero}: ${resultado.erro}`)
      continue
    }
    if (resultado.eventoId !== pedido.google_calendar_event_id) {
      const { error: erroGravar } = await supabase
        .from('pedidos')
        .update({ google_calendar_event_id: resultado.eventoId })
        .eq('id', pedido.id)
      if (erroGravar) {
        registrarFalha(`Pedido #${pedido.numero}: evento enviado, mas não consegui gravar o vínculo (${erroGravar.message})`)
        continue
      }
    }
    if (!resultado.eventoId) resumo.removidos++
    else if (resultado.criado) resumo.criados++
    else resumo.atualizados++
  }

  return { resumo }
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
  const { data: atual } = await supabase.from('pedidos').select('google_calendar_event_id').eq('id', _id).single()

  const { error } = await supabase.from('pedidos').delete().eq('id', _id)
  if (error) return { error: error.message }

  await excluirEventoPedido(atual?.google_calendar_event_id ?? null)

  revalidatePath('/pedidos')
  revalidatePath('/dashboard')
  return { success: true }
}
