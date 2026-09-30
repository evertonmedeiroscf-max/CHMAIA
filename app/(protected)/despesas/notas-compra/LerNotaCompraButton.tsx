'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { criarNotaCompra } from './actions'

// Igual ao "Importar despesas" (seletor nativo em modo múltiplo), mas aqui
// cada arquivo já é salvo e lido na hora — sem tela de conferência em
// memória, porque cada nota precisa de um id estável pra ir pra
// /despesas/notas-compra/[id] depois. Ao terminar o lote, leva pra lista
// onde as notas lidas aparecem prontas para aprovação.
export default function LerNotaCompraButton() {
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const [progresso, setProgresso] = useState<{ atual: number; total: number } | null>(null)
  const [erro, setErro] = useState('')

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivos = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (!arquivos.length) return

    setErro('')
    let algumaFalhaDeUpload = false

    for (let i = 0; i < arquivos.length; i++) {
      setProgresso({ atual: i + 1, total: arquivos.length })
      const formData = new FormData()
      formData.append('arquivo', arquivos[i])
      const resultado = await criarNotaCompra(undefined, formData)
      if (!resultado || resultado.error) {
        algumaFalhaDeUpload = true
      }
    }

    setProgresso(null)
    if (algumaFalhaDeUpload) {
      setErro('Uma ou mais notas não puderam ser enviadas — confira a lista de notas de compra.')
    }
    router.push('/despesas/notas-compra')
    router.refresh()
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*,application/pdf"
        style={{ display: 'none' }}
        onChange={handleFiles}
      />
      <button type="button" className="btn-secondary" onClick={() => inputRef.current?.click()} disabled={!!progresso}>
        {progresso ? `Lendo ${progresso.atual} de ${progresso.total}...` : 'Ler nota de compra'}
      </button>
      {erro && <p className="form-error">{erro}</p>}
    </>
  )
}
