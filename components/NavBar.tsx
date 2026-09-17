'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from '@/app/auth/actions'

const LINKS = [
  { href: '/dashboard', label: 'Resumo financeiro' },
  { href: '/pedidos', label: 'Pedidos' },
  { href: '/notas-fiscais', label: 'Relatório NF' },
  { href: '/despesas', label: 'Despesas' },
  { href: '/estoque', label: 'Estoque' },
]

export default function NavBar({
  userEmail,
  hasLowStock,
  isAdm,
  paginas,
}: {
  userEmail: string
  hasLowStock: boolean
  isAdm: boolean
  paginas: string[]
}) {
  const pathname = usePathname()
  const liberados = isAdm ? LINKS : LINKS.filter((link) => paginas.includes(link.href.slice(1)))
  const links = isAdm ? [...liberados, { href: '/usuarios', label: 'Usuários' }] : liberados

  return (
    <nav className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-brand">CHEF HILANA MAIA</div>
        <div className="sidebar-subtitle">Gestão</div>
      </div>

      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`nav-item${pathname.startsWith(link.href) ? ' active' : ''}`}
        >
          {link.label}
          {link.href === '/estoque' && hasLowStock && <span className="nav-low-stock-dot" />}
        </Link>
      ))}

      <div className="sidebar-spacer" />
      <div className="sidebar-footer">
        <div className="sidebar-email">{userEmail}</div>
        <form action={signOut}>
          <button type="submit" className="sidebar-logout">
            Sair
          </button>
        </form>
      </div>
    </nav>
  )
}
