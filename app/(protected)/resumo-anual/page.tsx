import { exigirAcesso } from '@/lib/supabase/acesso'
import ResumoAnualClient from './ResumoAnualClient'
import type { Despesa, Pedido } from '@/lib/types/domain'

// Permissão própria ('resumo-anual'), independente do resumo mensal — um
// ADM pode liberar um sem o outro. Os dados lidos continuam os mesmos
// (pedidos + despesas); as policies de RLS aceitam as duas chaves (ver
// 0018_separa_permissao_resumo_anual.sql).
export default async function ResumoAnualPage() {
  const supabase = await exigirAcesso('resumo-anual')
  const [{ data: pedidos, error: pedidosError }, { data: despesas, error: despesasError }] = await Promise.all([
    supabase.from('pedidos').select('*'),
    supabase.from('despesas').select('*'),
  ])

  if (pedidosError || despesasError) {
    return (
      <p className="form-error">
        Erro ao carregar dados: {pedidosError?.message ?? despesasError?.message}
      </p>
    )
  }

  return <ResumoAnualClient pedidos={(pedidos ?? []) as Pedido[]} despesas={(despesas ?? []) as Despesa[]} />
}
