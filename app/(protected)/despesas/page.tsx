import { createClient } from '@/lib/supabase/server'
import DespesasClient from './DespesasClient'
import type { Despesa } from '@/lib/types/domain'

export default async function DespesasPage() {
  const supabase = await createClient()
  const { data, error } = await supabase.from('despesas').select('*').order('data', { ascending: false })

  if (error) {
    return <p className="form-error">Erro ao carregar despesas: {error.message}</p>
  }

  return <DespesasClient despesas={(data ?? []) as Despesa[]} />
}
