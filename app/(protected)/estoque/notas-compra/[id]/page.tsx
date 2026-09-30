import { notFound } from 'next/navigation'
import { exigirAcesso } from '@/lib/supabase/acesso'
import ConferirItensNotaCompraClient from './ConferirItensNotaCompraClient'
import { normalizarTextoNota } from '@/lib/utils/notaCompra'
import type { EstoqueItem, NotaCompra, NotaCompraItem } from '@/lib/types/domain'

export default async function ConferirNotaCompraPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await exigirAcesso('estoque')

  const { data: nota } = await supabase.from('notas_compra').select('*').eq('id', id).single()
  if (!nota) notFound()

  const [{ data: itens }, { data: estoqueItens }, { data: assinatura }] = await Promise.all([
    supabase.from('notas_compra_itens').select('*').eq('nota_id', id).order('created_at', { ascending: true }),
    supabase.from('estoque_itens').select('*').order('nome', { ascending: true }),
    supabase.storage.from('notas-compra').createSignedUrl(nota.arquivo_path, 600),
  ])

  const listaItens = (itens ?? []) as NotaCompraItem[]
  const textosNormalizados = Array.from(new Set(listaItens.filter((i) => !i.validado).map((i) => normalizarTextoNota(i.texto_original))))

  const { data: apelidos } =
    textosNormalizados.length > 0
      ? await supabase.from('estoque_apelidos').select('*').in('texto_normalizado', textosNormalizados)
      : { data: [] }

  const sugestaoPorItemId = new Map<string, string>()
  listaItens.forEach((item) => {
    if (item.validado) return
    const apelido = apelidos?.find((a) => a.texto_normalizado === normalizarTextoNota(item.texto_original))
    if (apelido) sugestaoPorItemId.set(item.id, apelido.estoque_item_id)
  })

  return (
    <ConferirItensNotaCompraClient
      nota={nota as NotaCompra}
      itens={listaItens}
      estoqueItens={(estoqueItens ?? []) as EstoqueItem[]}
      fotoUrl={assinatura?.signedUrl ?? null}
      sugestoes={Object.fromEntries(sugestaoPorItemId)}
    />
  )
}
