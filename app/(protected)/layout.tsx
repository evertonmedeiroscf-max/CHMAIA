import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import NavBar from '@/components/NavBar'
import { signOut } from '@/app/auth/actions'

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: usuario } = await supabase.from('usuarios').select('aprovado, tipo, paginas').eq('id', user.id).single()

  // Sem linha aprovada aqui, o acesso fica bloqueado — tanto na tela (esta
  // checagem) quanto no banco (RLS exige usuario_esta_aprovado() em todas
  // as tabelas de negócio), então não dá para contornar chamando a API
  // do Supabase direto.
  if (!usuario?.aprovado) {
    return (
      <main className="auth-page">
        <div className="auth-form">
          <h1>Aguardando aprovação</h1>
          <p className="subtitle">Sistema de gestão</p>
          <p className="form-info">
            Seu cadastro ({user.email}) ainda não foi liberado. Peça para um administrador aprovar seu acesso.
          </p>
          <form action={signOut}>
            <button type="submit" className="btn-secondary" style={{ width: '100%' }}>
              Sair
            </button>
          </form>
        </div>
      </main>
    )
  }

  const { data: estoqueResumo } = await supabase.from('estoque_itens').select('quantidade_atual, quantidade_minima')
  const hasLowStock = (estoqueResumo ?? []).some((item) => item.quantidade_atual < item.quantidade_minima)

  return (
    <div className="app-shell">
      <NavBar
        userEmail={user.email ?? ''}
        hasLowStock={hasLowStock}
        isAdm={usuario.tipo === 'adm'}
        paginas={usuario.paginas ?? []}
      />
      <main className="app-content">{children}</main>
    </div>
  )
}
