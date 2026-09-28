'use client'

export default function Modal({
  title,
  onClose,
  children,
  wide,
  closeOnBackdropClick = true,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
  wide?: boolean
  // false em telas onde clicar fora por engano pode perder o que a pessoa
  // estava digitando (ex.: formulários de Estoque) — aí só fecha pelos
  // botões do rodapé (Salvar/Cancelar/Excluir).
  closeOnBackdropClick?: boolean
}) {
  return (
    <div className="modal-backdrop" onClick={closeOnBackdropClick ? onClose : undefined}>
      <div className={`modal-panel${wide ? ' modal-panel-wide' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">{title}</div>
        {children}
      </div>
    </div>
  )
}
