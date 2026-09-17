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

export default function NavBar({ userEmail, hasLowStock }: { userEmail: string; hasLowStock: boolean }) {
  const pathname = usePathname()

  return (
    <nav className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-brand">CHEF HILANA MAIA</div>
        <div className="sidebar-subtitle">Gestão</div>
      </div>

      {LINKS.map((link) => (
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
