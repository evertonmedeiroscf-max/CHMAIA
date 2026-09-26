'use client'

export default function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
  wide?: boolean
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={`modal-panel${wide ? ' modal-panel-wide' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">{title}</div>
        {children}
      </div>
    </div>
  )
}
