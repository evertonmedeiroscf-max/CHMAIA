'use client'

// Paginação simples reaproveitável em qualquer listagem — mostra "X–Y de Z"
// e navegação anterior/próxima. Não renderiza nada quando tudo cabe numa
// página só.
export default function Pagination({
  paginaAtual,
  totalPaginas,
  totalItens,
  itensPorPagina,
  onChange,
}: {
  paginaAtual: number
  totalPaginas: number
  totalItens: number
  itensPorPagina: number
  onChange: (pagina: number) => void
}) {
  if (totalPaginas <= 1) return null

  const inicio = totalItens === 0 ? 0 : (paginaAtual - 1) * itensPorPagina + 1
  const fim = Math.min(paginaAtual * itensPorPagina, totalItens)

  return (
    <div className="pagination">
      <span className="text-muted" style={{ fontSize: 12 }}>
        {inicio}–{fim} de {totalItens}
      </span>
      <div className="pagination-nav">
        <button type="button" onClick={() => onChange(paginaAtual - 1)} disabled={paginaAtual <= 1}>
          ‹ Anterior
        </button>
        <span>
          Página {paginaAtual} de {totalPaginas}
        </span>
        <button type="button" onClick={() => onChange(paginaAtual + 1)} disabled={paginaAtual >= totalPaginas}>
          Próxima ›
        </button>
      </div>
    </div>
  )
}
