'use client'

export default function ConfirmSubmitButton({
  children,
  confirmMessage,
}: {
  children: React.ReactNode
  confirmMessage: string
}) {
  return (
    <button
      type="submit"
      className="btn-danger"
      onClick={(e) => {
        if (!window.confirm(confirmMessage)) {
          e.preventDefault()
        }
      }}
    >
      {children}
    </button>
  )
}
