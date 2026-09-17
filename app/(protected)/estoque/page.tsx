import { exigirAcesso } from '@/lib/supabase/acesso'
import EstoqueClient from './EstoqueClient'
import type { EstoqueItem } from '@/lib/types/domain'

export default async function EstoquePage() {
  const supabase = await exigirAcesso('estoque')
  const { data, error } = await supabase.from('estoque_itens').select('*').order('nome', { ascending: true })

  if (error) {
    return <p className="form-error">Erro ao carregar estoque: {error.message}</p>
  }

  return <EstoqueClient itens={(data ?? []) as EstoqueItem[]} />
}
