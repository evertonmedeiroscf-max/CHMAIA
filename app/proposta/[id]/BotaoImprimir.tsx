'use client'

export default function BotaoImprimir() {
  return (
    <>
      <button type="button" className="btn-proposta" onClick={() => window.print()}>
        Imprimir / salvar em PDF
      </button>
      <button type="button" className="btn-secondary" onClick={() => window.close()}>
        Fechar
      </button>
    </>
  )
}
