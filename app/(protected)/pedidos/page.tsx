import { createClient } from '@/lib/supabase/server'
import PedidosClient from './PedidosClient'
import type { Pedido } from '@/lib/types/domain'

export default async function PedidosPage() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('pedidos')
    .select('*')
    .order('data_venda', { ascending: false })
    .order('numero', { ascending: false })

  if (error) {
    return <p className="form-error">Erro ao carregar pedidos: {error.message}</p>
  }

  return <PedidosClient pedidos={(data ?? []) as Pedido[]} />
}
