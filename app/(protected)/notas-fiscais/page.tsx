import { createClient } from '@/lib/supabase/server'
import NotasFiscaisClient from './NotasFiscaisClient'
import type { NotaFiscal, NotaFiscalComPedido, Pedido } from '@/lib/types/domain'

export default async function NotasFiscaisPage() {
  const supabase = await createClient()
  const [{ data: notas, error: notasError }, { data: pedidos, error: pedidosError }] = await Promise.all([
    supabase.from('notas_fiscais').select('*'),
    supabase.from('pedidos').select('*').order('numero', { ascending: false }),
  ])

  if (notasError || pedidosError) {
    return <p className="form-error">Erro ao carregar notas fiscais: {notasError?.message ?? pedidosError?.message}</p>
  }

  const pedidosList = (pedidos ?? []) as Pedido[]
  const pedidosPorId = new Map(pedidosList.map((p) => [p.id, p]))

  const notasComPedido: NotaFiscalComPedido[] = ((notas ?? []) as NotaFiscal[])
    .map((n) => {
      const pedido = pedidosPorId.get(n.pedido_id)
      if (!pedido) return null
      return {
        ...n,
        pedido_numero: pedido.numero,
        pedido_cliente: pedido.cliente,
        pedido_data_venda: pedido.data_venda,
      }
    })
    .filter((n): n is NotaFiscalComPedido => n !== null)

  return <NotasFiscaisClient notas={notasComPedido} pedidos={pedidosList} />
}
