import { notFound } from 'next/navigation'
import { exigirAcesso } from '@/lib/supabase/acesso'
import { carregarDadosFichas } from '../../dados'
import FichaEditor from '../../FichaEditor'
import { opcoesDeBase } from '../../bases'

export default async function EditarFichaTecnicaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await exigirAcesso('fichas-tecnicas')
  const { fichas, linhas, itens, resumos } = await carregarDadosFichas(supabase)

  const ficha = fichas.find((f) => f.id === id)
  if (!ficha) notFound()

  return (
    <FichaEditor
      ficha={ficha}
      ingredientes={linhas.filter((l) => l.ficha_id === id).sort((a, b) => a.ordem - b.ordem)}
      itens={itens}
      bases={opcoesDeBase(fichas, resumos)}
    />
  )
}
