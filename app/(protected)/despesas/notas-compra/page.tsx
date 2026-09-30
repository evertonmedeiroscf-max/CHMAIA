import { exigirAcesso } from '@/lib/supabase/acesso'
import NotasCompraClient from './NotasCompraClient'
import type { NotaCompra } from '@/lib/types/domain'

export default async function NotasCompraPage() {
  const supabase = await exigirAcesso('despesas')
  const { data, error } = await supabase.from('notas_compra').select('*').order('created_at', { ascending: false })

  if (error) {
    return <p className="form-error">Erro ao carregar notas de compra: {error.message}</p>
  }

  return <NotasCompraClient notas={(data ?? []) as NotaCompra[]} />
}
