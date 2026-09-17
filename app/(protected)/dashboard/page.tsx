import { createClient } from '@/lib/supabase/server'
import DashboardClient from './DashboardClient'
import type { Despesa, Pedido } from '@/lib/types/domain'

export default async function DashboardPage() {
  const supabase = await createClient()
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

  return <DashboardClient pedidos={(pedidos ?? []) as Pedido[]} despesas={(despesas ?? []) as Despesa[]} />
}
