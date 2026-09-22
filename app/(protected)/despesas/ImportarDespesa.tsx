'use client'

import { useRef, useState } from 'react'
import Modal from '@/components/Modal'
import { CATEGORIAS_DESPESA, FORMAS_PAGAMENTO } from '@/lib/types/domain'
import { createDespesasEmLote, extrairDespesaDeImagem } from './actions'

type Linha = {
  chave: string
  nomeArquivo: string
  data: string
  descricao: string
  valor: string
  categoria: string
  forma_pagamento: string
  erro?: string
}

// Um clique abre o seletor nativo de arquivos já em modo "selecionar vários"
// — o usuário navega até a pasta desejada e escolhe todos os comprovantes
// (extrato, prints, fotos, PDFs) de uma vez. Cada arquivo é lido pela IA em
// sequência; ao final, todas as linhas ficam numa tela de conferência onde
// dá pra corrigir ou remover antes de gravar tudo de uma vez na despesas.
export default function ImportarDespesa() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [progresso, setProgresso] = useState<{ atual: number; total: number } | null>(null)
  const [linhas, setLinhas] = useState<Linha[] | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erroSalvar, setErroSalvar] = useState('')

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivos = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (!arquivos.length) return

    setErroSalvar('')
    const hoje = new Date().toISOString().slice(0, 10)
    const lidas: Linha[] = []

    for (let i = 0; i < arquivos.length; i++) {
      setProgresso({ atual: i + 1, total: arquivos.length })
      const arquivo = arquivos[i]
      const formData = new FormData()
      formData.append('arquivo', arquivo)
      const resultado = await extrairDespesaDeImagem(undefined, formData)

      const semDadosSuficientes = !resultado || resultado.error || !resultado.descricao || resultado.valor === undefined
      lidas.push({
        chave: `${arquivo.name}-${i}`,
        nomeArquivo: arquivo.name,
        data: resultado?.data ?? hoje,
        descricao: resultado?.descricao ?? '',
        valor: resultado?.valor !== undefined ? String(resultado.valor) : '',
        categoria: CATEGORIAS_DESPESA[0],
        forma_pagamento: FORMAS_PAGAMENTO[0],
        erro: semDadosSuficientes ? resultado?.error ?? 'Não consegui ler este documento — preencha manualmente' : undefined,
      })
    }

    setProgresso(null)
    setLinhas(lidas)
  }

  function atualizarLinha(chave: string, campo: keyof Linha, valor: string) {
    setLinhas((atual) => atual?.map((l) => (l.chave === chave ? { ...l, [campo]: valor } : l)) ?? null)
  }

  function removerLinha(chave: string) {
    setLinhas((atual) => {
      const restante = atual?.filter((l) => l.chave !== chave) ?? []
      return restante.length ? restante : null
    })
  }

  async function salvarTodas() {
    if (!linhas?.length) return
    setErroSalvar('')

    for (const l of linhas) {
      if (!l.descricao.trim()) {
        setErroSalvar(`"${l.nomeArquivo}": preencha a descrição antes de salvar`)
        return
      }
      const valorNum = Number(l.valor)
      if (!l.valor || Number.isNaN(valorNum) || valorNum <= 0) {
        setErroSalvar(`"${l.nomeArquivo}": informe um valor válido antes de salvar`)
        return
      }
    }

    setSalvando(true)
    const resultado = await createDespesasEmLote(
      linhas.map((l) => ({
        data: l.data,
        categoria: l.categoria,
        descricao: l.descricao.trim(),
        valor: Number(l.valor),
        forma_pagamento: l.forma_pagamento || null,
      }))
    )
    setSalvando(false)

    if (resultado?.error) {
      setErroSalvar(resultado.error)
      return
    }
    setLinhas(null)
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
        {progresso ? `Lendo ${progresso.atual} de ${progresso.total}...` : 'Importar despesas'}
      </button>

      {linhas && (
        <Modal title={`Conferir despesas importadas (${linhas.length})`} onClose={() => (salvando ? null : setLinhas(null))}>
          <p className="modal-item-label" style={{ marginBottom: 12 }}>
            A IA leu estes dados dos documentos selecionados — confira, corrija o que precisar e remova o que não for despesa.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '55vh', overflowY: 'auto', paddingRight: 4 }}>
            {linhas.map((l) => (
              <div
                key={l.chave}
                style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span className="text-muted" style={{ fontSize: 13, fontWeight: 600 }}>
                    {l.nomeArquivo}
                  </span>
                  <button type="button" className="action-link" onClick={() => removerLinha(l.chave)}>
                    remover
                  </button>
                </div>

                {l.erro && (
                  <p className="form-error" style={{ marginBottom: 8 }}>
                    {l.erro}
                  </p>
                )}

                <div className="modal-fields">
                  <div className="modal-row">
                    <label>
                      Data
                      <input
                        type="date"
                        value={l.data}
                        onChange={(e) => atualizarLinha(l.chave, 'data', e.target.value)}
                      />
                    </label>
                    <label>
                      Categoria
                      <select value={l.categoria} onChange={(e) => atualizarLinha(l.chave, 'categoria', e.target.value)}>
                        {CATEGORIAS_DESPESA.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label>
                    Descrição
                    <input
                      type="text"
                      value={l.descricao}
                      onChange={(e) => atualizarLinha(l.chave, 'descricao', e.target.value)}
                    />
                  </label>
                  <div className="modal-row">
                    <label>
                      Valor (R$)
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={l.valor}
                        onChange={(e) => atualizarLinha(l.chave, 'valor', e.target.value)}
                      />
                    </label>
                    <label>
                      Pagamento
                      <select
                        value={l.forma_pagamento}
                        onChange={(e) => atualizarLinha(l.chave, 'forma_pagamento', e.target.value)}
                      >
                        {FORMAS_PAGAMENTO.map((fp) => (
                          <option key={fp} value={fp}>
                            {fp}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {erroSalvar && (
            <p className="form-error" style={{ marginTop: 14 }}>
              {erroSalvar}
            </p>
          )}

          <div className="modal-footer">
            <div />
            <div className="modal-footer-right">
              <button type="button" className="btn-secondary" onClick={() => setLinhas(null)} disabled={salvando}>
                Cancelar
              </button>
              <button type="button" className="btn-primary" onClick={salvarTodas} disabled={salvando}>
                {salvando ? 'Salvando...' : `Salvar ${linhas.length} despesa${linhas.length > 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
