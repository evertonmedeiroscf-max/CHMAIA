'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useFormState, useFormStatus } from 'react-dom'
import Modal from '@/components/Modal'
import ItemForm from '../../ItemForm'
import { formatCurrency, formatDateBR } from '@/lib/utils/format'
import { STATUS_NOTA_COMPRA_BADGE, STATUS_NOTA_COMPRA_LABEL } from '@/lib/utils/notaCompra'
import type { EstoqueItem, NotaCompra, NotaCompraItem } from '@/lib/types/domain'
import { confirmarItemNotaCompra } from '../actions'

function ConfirmarButton() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'Confirmando...' : 'Confirmar'}
    </button>
  )
}

function LinhaItem({
  item,
  estoqueItens,
  sugestaoInicial,
  onCriarNovoItem,
}: {
  item: NotaCompraItem
  estoqueItens: EstoqueItem[]
  sugestaoInicial: string | undefined
  onCriarNovoItem: () => void
}) {
  const [state, formAction] = useFormState(confirmarItemNotaCompra.bind(null, item.id), undefined)
  const [estoqueItemId, setEstoqueItemId] = useState(item.estoque_item_id ?? sugestaoInicial ?? '')

  const itemSelecionado = estoqueItens.find((e) => e.id === estoqueItemId)

  if (item.validado) {
    const itemConfirmado = estoqueItens.find((e) => e.id === item.estoque_item_id)
    return (
      <div className="table-row" style={{ gridTemplateColumns: '1fr 200px 120px 120px 100px' }}>
        <div className="text-muted">{item.texto_original}</div>
        <div className="col-center">{itemConfirmado?.nome ?? '-'}</div>
        <div className="col-center">
          {item.quantidade} {itemConfirmado?.unidade_medida ?? ''}
        </div>
        <div className="col-center">{formatCurrency(item.valor_total)}</div>
        <div className="col-center">
          <span className="badge badge-pago">Confirmado</span>
        </div>
      </div>
    )
  }

  return (
    <form action={formAction} className="table-row" style={{ gridTemplateColumns: '1fr 200px 120px 120px 100px', alignItems: 'center' }}>
      <div className="text-muted">{item.texto_original}</div>
      <div>
        <select
          name="estoque_item_id"
          className="select-control"
          style={{ width: '100%' }}
          value={estoqueItemId}
          onChange={(e) => {
            if (e.target.value === '__novo__') {
              onCriarNovoItem()
              return
            }
            setEstoqueItemId(e.target.value)
          }}
          required
        >
          <option value="">Selecione o item...</option>
          {estoqueItens.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nome}
            </option>
          ))}
          <option value="__novo__">+ criar novo item</option>
        </select>
      </div>
      <div className="col-center">
        <input type="number" name="quantidade" step="0.001" min="0.001" defaultValue={item.quantidade} required style={{ width: '100%' }} />
        {itemSelecionado && (
          <span className="text-muted" style={{ fontSize: 11 }}>
            {itemSelecionado.unidade_medida}
          </span>
        )}
      </div>
      <div className="col-center">
        <input type="number" name="valor_total" step="0.01" min="0" defaultValue={item.valor_total} required style={{ width: '100%' }} />
      </div>
      <div className="col-center">
        <ConfirmarButton />
        {state?.error && (
          <p className="form-error" style={{ fontSize: 11, marginTop: 4 }}>
            {state.error}
          </p>
        )}
      </div>
    </form>
  )
}

export default function ConferirItensNotaCompraClient({
  nota,
  itens,
  estoqueItens,
  fotoUrl,
  sugestoes,
}: {
  nota: NotaCompra
  itens: NotaCompraItem[]
  estoqueItens: EstoqueItem[]
  fotoUrl: string | null
  sugestoes: Record<string, string>
}) {
  const router = useRouter()
  const [modalNovoItem, setModalNovoItem] = useState(false)
  const isPdf = nota.mime_type === 'application/pdf'

  function fecharModalNovoItem() {
    setModalNovoItem(false)
    router.refresh()
  }

  return (
    <div>
      <div className="page-header">
        <h1>{nota.estabelecimento ?? nota.nome_exibicao ?? 'Nota de compra'}</h1>
        <Link href="/estoque/notas-compra">Voltar</Link>
      </div>

      <p style={{ marginBottom: 16 }}>
        <span className={`badge ${STATUS_NOTA_COMPRA_BADGE[nota.status]}`}>{STATUS_NOTA_COMPRA_LABEL[nota.status]}</span>
        {nota.data_compra && <span className="text-muted"> — compra em {formatDateBR(nota.data_compra)}</span>}
      </p>

      {fotoUrl && (
        <div style={{ marginBottom: 20, maxWidth: 320 }}>
          {isPdf ? (
            <a href={fotoUrl} target="_blank" rel="noreferrer" className="btn-secondary">
              Abrir PDF do comprovante
            </a>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={fotoUrl} alt="Comprovante da compra" style={{ maxWidth: '100%', borderRadius: 6, border: '1px solid var(--border)' }} />
          )}
        </div>
      )}

      <div className="data-table table-scroll">
        <div className="table-row table-head" style={{ gridTemplateColumns: '1fr 200px 120px 120px 100px' }}>
          <div>ITEM (COMO LIDO)</div>
          <div className="col-center">ITEM DO ESTOQUE</div>
          <div className="col-center">QTD.</div>
          <div className="col-center">VALOR</div>
          <div className="col-center">AÇÃO</div>
        </div>
        {itens.map((item) => (
          <LinhaItem
            key={item.id}
            item={item}
            estoqueItens={estoqueItens}
            sugestaoInicial={sugestoes[item.id]}
            onCriarNovoItem={() => setModalNovoItem(true)}
          />
        ))}
        {itens.length === 0 && <div className="empty-state">Nenhum item identificado nessa nota.</div>}
      </div>

      {modalNovoItem && (
        <Modal title="Novo item de estoque" onClose={fecharModalNovoItem} closeOnBackdropClick={false}>
          <ItemForm onClose={fecharModalNovoItem} />
        </Modal>
      )}
    </div>
  )
}
