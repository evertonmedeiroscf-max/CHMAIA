import type { createClient } from '@/lib/supabase/server'
import type { EventoAmanha } from '@/lib/utils/eventosAmanha'

// Pedidos cujo EVENTO é amanhã (data_evento), na ordem do dia (quem não tem hora vai por último).
// Pedido sem data de evento não entra: não dá para saber em que dia acontece.
// A leitura passa pela segurança do banco (RLS) com o login de quem está vendo; quem chama ainda
// confere se a pessoa tem acesso a Pedidos antes de mostrar o lembrete.
export async function carregarEventosAmanha(
  supabase: Awaited<ReturnType<typeof createClient>>,
  amanha: string
): Promise<EventoAmanha[]> {
  const { data, error } = await supabase
    .from('pedidos')
    .select('id, cliente, entidade, hora_evento, valor_total, valor_pago, falta_pagar, status')
    .eq('data_evento', amanha)
    .order('hora_evento', { ascending: true, nullsFirst: false })
    .order('numero', { ascending: true })

  // O lembrete é um extra: se a consulta falhar, o sistema segue normal, só sem o aviso.
  if (error) {
    console.error('Lembrete de eventos de amanhã: falha ao ler os pedidos —', error.message)
    return []
  }
  return (data ?? []) as EventoAmanha[]
}

// Os eventos de VÁRIOS dias de uma vez, agrupados por dia (cada dia na ordem do dia). Usado pelo
// lembrete na Google Agenda. Dia sem pedido simplesmente não aparece no mapa. Se a leitura falhar,
// devolve erro — quem chama NÃO pode tratar isso como "dia sem eventos" (apagaria o lembrete).
export async function carregarEventosDosDias(
  supabase: Awaited<ReturnType<typeof createClient>>,
  dias: string[]
): Promise<{ ok: true; porDia: Map<string, EventoAmanha[]> } | { ok: false; erro: string }> {
  const porDia = new Map<string, EventoAmanha[]>()
  if (dias.length === 0) return { ok: true, porDia }

  const { data, error } = await supabase
    .from('pedidos')
    .select('id, cliente, entidade, data_evento, hora_evento, valor_total, valor_pago, falta_pagar, status')
    .in('data_evento', dias)
    .order('hora_evento', { ascending: true, nullsFirst: false })
    .order('numero', { ascending: true })
  if (error) return { ok: false, erro: error.message }

  for (const linha of data ?? []) {
    if (!linha.data_evento) continue
    const { data_evento, ...evento } = linha
    const lista = porDia.get(data_evento) ?? []
    lista.push(evento as EventoAmanha)
    porDia.set(data_evento, lista)
  }
  return { ok: true, porDia }
}
