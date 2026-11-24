import { exigirAcesso } from '@/lib/supabase/acesso'
import OrcamentosClient from './OrcamentosClient'
import type { Orcamento, Produto } from '@/lib/types/domain'

// Aprovar/editar um orçamento gera ou altera o pedido e refaz o lembrete diário da Google Agenda
// (chamada externa) — dá mais tempo que o padrão da Vercel, como na tela de Pedidos.
export const maxDuration = 60

export default async function OrcamentosPage() {
  const supabase = await exigirAcesso('orcamentos')
  const [{ data, error }, { data: produtos }] = await Promise.all([
    supabase.from('orcamentos').select('*').order('data_orcamento', { ascending: false }).order('numero', { ascending: false }),
    supabase.from('produtos').select('*').eq('ativo', true).order('nome', { ascending: true }),
  ])

  if (error) {
    return <p className="form-error">Erro ao carregar orçamentos: {error.message}</p>
  }

  return (
    <OrcamentosClient orcamentos={(data ?? []) as unknown as Orcamento[]} produtos={(produtos ?? []) as Produto[]} />
  )
}
