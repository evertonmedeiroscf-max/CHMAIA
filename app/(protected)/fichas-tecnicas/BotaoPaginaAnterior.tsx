'use client'

import { useRouter } from 'next/navigation'

// Volta para a página em que a pessoa estava antes (histórico do navegador). Se a
// ficha foi aberta direto (aba nova, link colado) e não há página anterior, cai no
// índice em vez de não fazer nada.
export default function BotaoPaginaAnterior({ alternativa = '/fichas-tecnicas' }: { alternativa?: string }) {
  const router = useRouter()

  function voltar() {
    if (window.history.length > 1) router.back()
    else router.push(alternativa)
  }

  return (
    <button type="button" className="btn-secondary" onClick={voltar}>
      ← Página anterior
    </button>
  )
}
