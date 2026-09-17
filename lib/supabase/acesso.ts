import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { PaginaSistema } from '@/lib/types/domain'

// Chamar no topo de cada page.tsx protegida por módulo (dashboard,
// pedidos, despesas, estoque, notas-fiscais). Redireciona para
// /sem-acesso em vez de /dashboard — se a própria página de destino
// também estivesse fora do `paginas` do usuário, um redirect para lá
// causaria loop.
export async function exigirAcesso(pagina: PaginaSistema) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: usuario } = await supabase.from('usuarios').select('tipo, paginas').eq('id', user.id).single()
  const temAcesso = usuario?.tipo === 'adm' || (usuario?.paginas ?? []).includes(pagina)
  if (!temAcesso) redirect('/sem-acesso')

  return supabase
}
