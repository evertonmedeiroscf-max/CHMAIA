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

// O usuário logado é ADM (e está aprovado)? É a mesma regra da função usuario_e_adm() do
// banco, que é quem de fato barra as gravações só de ADM. Aqui serve para escolher o que a
// tela mostra e para recusar cedo; nunca use só isto como proteção.
export async function usuarioEhAdm(supabase: Awaited<ReturnType<typeof createClient>>): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return false
  const { data } = await supabase.from('usuarios').select('tipo, aprovado').eq('id', user.id).maybeSingle()
  return data?.tipo === 'adm' && data.aprovado === true
}
