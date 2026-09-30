import { notFound } from 'next/navigation'
import { exigirAcesso } from '@/lib/supabase/acesso'
import AprovarNotaCompraClient from './AprovarNotaCompraClient'
import type { NotaCompra, NotaCompraItem } from '@/lib/types/domain'

export default async function NotaCompraDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await exigirAcesso('despesas')

  const { data: nota } = await supabase.from('notas_compra').select('*').eq('id', id).single()
  if (!nota) notFound()

  const { data: itens } = await supabase
    .from('notas_compra_itens')
    .select('*')
    .eq('nota_id', id)
    .order('created_at', { ascending: true })

  const { data: assinatura } = await supabase.storage.from('notas-compra').createSignedUrl(nota.arquivo_path, 600)

  let notaRepetida = false
  if (nota.estabelecimento && nota.data_compra) {
    const { count } = await supabase
      .from('notas_compra')
      .select('id', { count: 'exact', head: true })
      .neq('id', id)
      .eq('estabelecimento', nota.estabelecimento)
      .eq('data_compra', nota.data_compra)
    notaRepetida = !!count && count > 0
  }

  return (
    <AprovarNotaCompraClient
      nota={nota as NotaCompra}
      itens={(itens ?? []) as NotaCompraItem[]}
      fotoUrl={assinatura?.signedUrl ?? null}
      notaRepetida={notaRepetida}
    />
  )
}
