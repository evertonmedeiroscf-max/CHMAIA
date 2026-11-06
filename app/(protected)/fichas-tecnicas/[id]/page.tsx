import { notFound } from 'next/navigation'
import { exigirAcesso } from '@/lib/supabase/acesso'
import { carregarDadosFichas } from '../dados'
import FichaVisualizacao from '../FichaVisualizacao'
import { montarLinhasVisuais } from '../visual'

export default async function FichaTecnicaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await exigirAcesso('fichas-tecnicas')
  const { fichas, linhas, itens, resumos } = await carregarDadosFichas(supabase)

  const ficha = fichas.find((f) => f.id === id)
  const resumo = resumos.get(id)
  if (!ficha || !resumo) notFound()

  return <FichaVisualizacao ficha={ficha} resumo={resumo} linhas={montarLinhasVisuais(id, linhas, itens, fichas, resumos)} />
}
