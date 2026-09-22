'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from '@/app/auth/actions'

const LINKS = [
  { href: '/dashboard', label: 'Resumo financeiro' },
  { href: '/orcamentos', label: 'Orçamentos' },
  { href: '/produtos', label: 'Produtos' },
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
  const [menuAberto, setMenuAberto] = useState(false)
  const liberados = isAdm ? LINKS : LINKS.filter((link) => paginas.includes(link.href.slice(1)))
  const links = isAdm
    ? [...liberados, { href: '/usuarios', label: 'Usuários' }, { href: '/historico', label: 'Histórico' }]
    : liberados

  // Fecha o menu ao trocar de página (o layout não remonta em navegação
  // client-side, então sem isso o menu ficaria aberto na tela seguinte).
  useEffect(() => {
    setMenuAberto(false)
  }, [pathname])

  return (
    <>
      <div className="mobile-topbar">
        <div className="sidebar-brand">CHEF HILANA MAIA</div>
        <button
          type="button"
          className="mobile-menu-toggle"
          onClick={() => setMenuAberto((v) => !v)}
          aria-label={menuAberto ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={menuAberto}
        >
          {menuAberto ? '✕' : '☰'}
        </button>
      </div>

      {menuAberto && <div className="mobile-nav-backdrop" onClick={() => setMenuAberto(false)} />}

      <nav className={`sidebar${menuAberto ? ' open' : ''}`}>
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
    </>
  )
}
