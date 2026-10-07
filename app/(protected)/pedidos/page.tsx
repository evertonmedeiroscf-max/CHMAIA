import { exigirAcesso } from '@/lib/supabase/acesso'
import { googleAgendaConfigurada } from '@/lib/google/calendar'
import PedidosClient from './PedidosClient'
import type { Pedido } from '@/lib/types/domain'

// O botão "Sincronizar com Google Agenda" do Calendário envia vários eventos
// numa só ação do servidor — dá mais tempo que o padrão da Vercel (10s).
export const maxDuration = 60

export default async function PedidosPage() {
  const supabase = await exigirAcesso('pedidos')
  const { data, error } = await supabase
    .from('pedidos')
    .select('*')
    .order('data_venda', { ascending: false })
    .order('numero', { ascending: false })

  if (error) {
    return <p className="form-error">Erro ao carregar pedidos: {error.message}</p>
  }

  return <PedidosClient pedidos={(data ?? []) as Pedido[]} googleAgendaConfigurada={googleAgendaConfigurada()} />
}
