import { exigirAcesso } from '@/lib/supabase/acesso'
import { carregarItensEstoque } from '../dados'
import FichaEditor from '../FichaEditor'

export default async function NovaFichaTecnicaPage() {
  const supabase = await exigirAcesso('fichas-tecnicas')
  const itens = await carregarItensEstoque(supabase)
  return <FichaEditor ingredientes={[]} itens={itens} />
}
