import { exigirAcesso } from '@/lib/supabase/acesso'
import ProdutosClient from './ProdutosClient'
import type { Produto } from '@/lib/types/domain'

export default async function ProdutosPage() {
  const supabase = await exigirAcesso('produtos')
  const { data, error } = await supabase.from('produtos').select('*').order('nome', { ascending: true })

  if (error) {
    return <p className="form-error">Erro ao carregar produtos: {error.message}</p>
  }

  return <ProdutosClient produtos={(data ?? []) as Produto[]} />
}
