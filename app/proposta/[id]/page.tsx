import { notFound } from 'next/navigation'
import { exigirAcesso } from '@/lib/supabase/acesso'
import type { Orcamento } from '@/lib/types/domain'
import PropostaDocumento from './PropostaDocumento'

// Proposta para o cliente gerada a partir de um orçamento salvo (botão
// "Gerar proposta" no modal do orçamento). Fica fora do grupo (protected)
// para não herdar a barra lateral — sai limpa na impressão / PDF — mas
// exige o mesmo acesso da aba Orçamentos. Mostra o cardápio (itens e
// quantidades) e o investimento total/por pessoa; o preço de cada item e o
// % de extras são custo interno e não aparecem aqui.
export default async function PropostaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await exigirAcesso('orcamentos')
  const { data } = await supabase.from('orcamentos').select('*').eq('id', id).single()
  if (!data) notFound()
  return <PropostaDocumento orcamento={data as unknown as Orcamento} />
}
