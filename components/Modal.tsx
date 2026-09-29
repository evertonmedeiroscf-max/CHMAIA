'use client'

export default function Modal({
  title,
  onClose,
  children,
  wide,
  medium,
  closeOnBackdropClick = true,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
  wide?: boolean
  // Meio-termo entre o modal padrão (460px, formulários) e o wide (1080px,
  // painéis tipo dashboard) — pra listas/tabelas simples de poucas colunas
  // que não cabem em 460px mas ficariam esparsas em 1080px.
  medium?: boolean
  // false em telas onde clicar fora por engano pode perder o que a pessoa
  // estava digitando (ex.: formulários de Estoque) — aí só fecha pelos
  // botões do rodapé (Salvar/Cancelar/Excluir).
  closeOnBackdropClick?: boolean
}) {
  return (
    <div className="modal-backdrop" onClick={closeOnBackdropClick ? onClose : undefined}>
      <div
        className={`modal-panel${wide ? ' modal-panel-wide' : ''}${medium ? ' modal-panel-medium' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-title">{title}</div>
        {children}
      </div>
    </div>
  )
}
