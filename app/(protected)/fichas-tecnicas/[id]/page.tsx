import { notFound } from 'next/navigation'
import { exigirAcesso } from '@/lib/supabase/acesso'
import type { FichaTecnica, FichaTecnicaIngrediente } from '@/lib/types/domain'
import { carregarItensEstoque } from '../dados'
import FichaEditor from '../FichaEditor'

export default async function EditarFichaTecnicaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await exigirAcesso('fichas-tecnicas')

  const { data: ficha } = await supabase.from('fichas_tecnicas').select('*').eq('id', id).maybeSingle()
  if (!ficha) notFound()

  const { data: ingredientes } = await supabase
    .from('fichas_tecnicas_ingredientes')
    .select('*')
    .eq('ficha_id', id)
    .order('ordem', { ascending: true })

  const itens = await carregarItensEstoque(supabase)

  return (
    <FichaEditor
      ficha={ficha as FichaTecnica}
      ingredientes={(ingredientes ?? []) as FichaTecnicaIngrediente[]}
      itens={itens}
    />
  )
}
