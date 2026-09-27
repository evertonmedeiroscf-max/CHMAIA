import { exigirAcesso } from '@/lib/supabase/acesso'
import ResumoAnualClient from './ResumoAnualClient'
import type { Despesa, Pedido } from '@/lib/types/domain'

// Usa a mesma permissão 'dashboard' do resumo mensal — os dados lidos são
// os mesmos (pedidos + despesas), então não há policy nova no banco.
export default async function ResumoAnualPage() {
  const supabase = await exigirAcesso('dashboard')
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
