import { exigirAcesso } from '@/lib/supabase/acesso'
import type { TipoFicha } from '@/lib/types/domain'
import { carregarDadosFichas } from '../dados'
import FichaEditor from '../FichaEditor'
import { opcoesDeBase } from '../bases'

export default async function NovaFichaTecnicaPage({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const { tipo } = await searchParams
  const tipoNovo: TipoFicha = tipo === 'finalizacao' ? 'finalizacao' : 'bases'
  const supabase = await exigirAcesso('fichas-tecnicas')
  const { fichas, itens, resumos } = await carregarDadosFichas(supabase)
  return <FichaEditor tipoNovo={tipoNovo} ingredientes={[]} itens={itens} bases={opcoesDeBase(fichas, resumos)} />
}
