'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useFormState, useFormStatus } from 'react-dom'
import { CATEGORIAS_DESPESA, FORMAS_PAGAMENTO, type NotaCompra, type NotaCompraItem } from '@/lib/types/domain'
import { formatCurrency, formatDateBR } from '@/lib/utils/format'
import { STATUS_NOTA_COMPRA_BADGE, STATUS_NOTA_COMPRA_LABEL } from '@/lib/utils/notaCompra'
import { aprovarDespesaNotaCompra, reprocessarNotaCompra } from '../actions'

function AprovarButton() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'Aprovando...' : 'Aprovar despesa'}
    </button>
  )
}

export default function AprovarNotaCompraClient({
  nota,
  itens,
  fotoUrl,
  notaRepetida,
}: {
  nota: NotaCompra
  itens: NotaCompraItem[]
  fotoUrl: string | null
  notaRepetida: boolean
}) {
  const [state, formAction] = useFormState(aprovarDespesaNotaCompra.bind(null, nota.id), undefined)
  const [reprocessando, setReprocessando] = useState(false)
  const [erroReprocessar, setErroReprocessar] = useState('')

  useEffect(() => {
    if (state?.success) {
      window.location.href = '/despesas/notas-compra'
    }
  }, [state])

  async function handleReprocessar() {
    setReprocessando(true)
    setErroReprocessar('')
    const resultado = await reprocessarNotaCompra(nota.id)
    setReprocessando(false)
    if (resultado?.error) {
      setErroReprocessar(resultado.error)
      return
    }
    window.location.reload()
  }

  const editavel = nota.status === 'aguardando_aprovacao' || nota.status === 'falha_leitura'
  const isPdf = nota.mime_type === 'application/pdf'

  return (
    <div>
      <div className="page-header">
        <h1>{nota.estabelecimento ?? nota.nome_exibicao ?? 'Nota de compra'}</h1>
        <Link href="/despesas/notas-compra">Voltar</Link>
      </div>

      <p style={{ marginBottom: 16 }}>
        <span className={`badge ${STATUS_NOTA_COMPRA_BADGE[nota.status]}`}>{STATUS_NOTA_COMPRA_LABEL[nota.status]}</span>
      </p>

      {notaRepetida && (
        <p className="form-error" style={{ marginBottom: 16 }}>
          Já existe outra nota do mesmo estabelecimento nesta data — confira se não é um comprovante duplicado antes
          de aprovar.
        </p>
      )}

      {nota.status === 'falha_leitura' && (
        <p className="form-error" style={{ marginBottom: 16 }}>
          Não consegui ler esse documento automaticamente{nota.erro_processamento ? `: ${nota.erro_processamento}` : ''}.
          Você pode tentar ler de novo, ou preencher a despesa manualmente abaixo.
        </p>
      )}

      <div className="modal-row" style={{ alignItems: 'flex-start', gap: 24 }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          {fotoUrl ? (
            isPdf ? (
              <a href={fotoUrl} target="_blank" rel="noreferrer" className="btn-secondary">
                Abrir PDF do comprovante
              </a>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={fotoUrl} alt="Comprovante da compra" style={{ maxWidth: '100%', borderRadius: 6, border: '1px solid var(--border)' }} />
            )
          ) : (
            <p className="text-muted">Não foi possível carregar a imagem do comprovante.</p>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 280 }}>
          <form action={formAction} className="modal-fields">
            <div className="modal-row">
              <label>
                Data
                <input type="date" name="data" defaultValue={nota.data_compra ?? ''} required disabled={!editavel} />
              </label>
              <label>
                Categoria
                <select name="categoria" defaultValue="Insumos/Compras" disabled={!editavel}>
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
                name="descricao"
                placeholder="Ex: Compra de hortifruti"
                defaultValue={nota.estabelecimento ?? ''}
                required
                disabled={!editavel}
              />
            </label>
            <div className="modal-row">
              <label>
                Valor (R$)
                <input
                  type="number"
                  name="valor"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  defaultValue={nota.valor_total_lido ?? ''}
                  required
                  disabled={!editavel}
                />
              </label>
              <label>
                Pagamento
                <select name="forma_pagamento" defaultValue="" disabled={!editavel}>
                  <option value="">-</option>
                  {FORMAS_PAGAMENTO.map((fp) => (
                    <option key={fp} value={fp}>
                      {fp}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {state?.error && <p className="form-error">{state.error}</p>}

            {editavel && (
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={handleReprocessar} disabled={reprocessando}>
                  {reprocessando ? 'Lendo de novo...' : 'Tentar ler de novo'}
                </button>
                <div className="modal-footer-right">
                  <AprovarButton />
                </div>
              </div>
            )}
            {erroReprocessar && <p className="form-error">{erroReprocessar}</p>}
          </form>
        </div>
      </div>

      <h2 style={{ marginTop: 28 }}>Itens identificados</h2>
      <p className="modal-item-label" style={{ marginBottom: 12 }}>
        Só pra conferência — a entrada desses itens no estoque é feita depois, na aba Estoque.
      </p>
      <div className="data-table">
        <div className="table-row table-head" style={{ gridTemplateColumns: '1fr 110px 120px' }}>
          <div>ITEM (COMO LIDO)</div>
          <div className="col-center">QTD.</div>
          <div className="col-center">VALOR</div>
        </div>
        {itens.map((item) => (
          <div key={item.id} className="table-row" style={{ gridTemplateColumns: '1fr 110px 120px' }}>
            <div>{item.texto_original}</div>
            <div className="col-center text-muted">{item.quantidade}</div>
            <div className="col-center text-muted">{formatCurrency(item.valor_total)}</div>
          </div>
        ))}
        {itens.length === 0 && <div className="empty-state">Nenhum item identificado nesse documento.</div>}
      </div>

      {(nota.status === 'aprovada' || nota.status === 'concluida') && (
        <p className="modal-item-label" style={{ marginTop: 16 }}>
          Despesa aprovada{nota.data_compra ? ` em ${formatDateBR(nota.data_compra)}` : ''}.
        </p>
      )}
    </div>
  )
}
