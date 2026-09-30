import { exigirAcesso } from '@/lib/supabase/acesso'
import NotasCompraEstoqueClient from './NotasCompraEstoqueClient'
import type { NotaCompra, NotaCompraItem } from '@/lib/types/domain'

export default async function NotasCompraEstoquePage() {
  const supabase = await exigirAcesso('estoque')

  const { data: notas, error } = await supabase
    .from('notas_compra')
    .select('*')
    .in('status', ['aprovada', 'concluida'])
    .order('created_at', { ascending: false })

  if (error) {
    return <p className="form-error">Erro ao carregar notas de compra: {error.message}</p>
  }

  const notasList = (notas ?? []) as NotaCompra[]
  const { data: itens } = await supabase
    .from('notas_compra_itens')
    .select('*')
    .in('nota_id', notasList.map((n) => n.id).length ? notasList.map((n) => n.id) : [''])

  return <NotasCompraEstoqueClient notas={notasList} itens={(itens ?? []) as NotaCompraItem[]} />
}
