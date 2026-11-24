import { notFound } from 'next/navigation'
import { exigirAcesso, usuarioEhAdm } from '@/lib/supabase/acesso'
import { carregarDadosFichas, carregarLembretes } from '../../dados'
import FichaEditor from '../../FichaEditor'
import { opcoesDeBase } from '../../bases'

export default async function EditarFichaTecnicaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await exigirAcesso('fichas-tecnicas')
  const [{ fichas, linhas, itens, resumos }, lembretes, ehAdm] = await Promise.all([carregarDadosFichas(supabase), carregarLembretes(supabase), usuarioEhAdm(supabase)])

  const ficha = fichas.find((f) => f.id === id)
  if (!ficha) notFound()

  return (
    <FichaEditor
      ficha={ficha}
      ingredientes={linhas.filter((l) => l.ficha_id === id).sort((a, b) => a.ordem - b.ordem)}
      itens={itens}
      bases={opcoesDeBase(fichas, resumos)}
      lembretes={lembretes}
      ehAdm={ehAdm}
    />
  )
}
