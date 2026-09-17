import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import NavBar from '@/components/NavBar'

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: estoqueResumo } = await supabase.from('estoque_itens').select('quantidade_atual, quantidade_minima')
  const hasLowStock = (estoqueResumo ?? []).some((item) => item.quantidade_atual < item.quantidade_minima)

  return (
    <div className="app-shell">
      <NavBar userEmail={user.email ?? ''} hasLowStock={hasLowStock} />
      <main className="app-content">{children}</main>
    </div>
  )
}
