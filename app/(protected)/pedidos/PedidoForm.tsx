'use client'

import { useEffect, useMemo, useState } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { ENTIDADE_TIPOS, FORMAS_PAGAMENTO, STATUS_PEDIDO, type Pedido, type StatusPedido } from '@/lib/types/domain'
import { createPedido, deletePedido, updatePedido, type ActionState } from './actions'

const STATUS_LABEL: Record<StatusPedido, string> = {
  pendente: 'Pendente',
  '50% pago': '50% pago',
  pago: 'Pago',
}

function sugerirStatus(valorTotal: number, valorPago: number): StatusPedido {
  if (valorTotal <= 0 || valorPago <= 0) return 'pendente'
  if (valorPago >= valorTotal) return 'pago'
  if (valorPago >= valorTotal / 2) return '50% pago'
  return 'pendente'
}

function SaveButton({ formId }: { formId: string }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" form={formId} className="btn-primary" disabled={pending}>
      {pending ? 'Salvando...' : 'Salvar'}
    </button>
  )
}

function DeleteButton() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className="btn-danger" disabled={pending}>
      {pending ? 'Excluindo...' : 'Excluir'}
    </button>
  )
}

export default function PedidoForm({ pedido, onClose }: { pedido?: Pedido; onClose: () => void }) {
  const action = useMemo(() => (pedido ? updatePedido.bind(null, pedido.id) : createPedido), [pedido])
  const [state, formAction] = useFormState(action, undefined)
  const [deleteState, deleteAction] = useFormState(
    pedido ? deletePedido.bind(null, pedido.id) : async (): Promise<ActionState> => undefined,
    undefined
  )

  const [valorTotal, setValorTotal] = useState(pedido?.valor_total ?? 0)
  const [valorPago, setValorPago] = useState(pedido?.valor_pago ?? 0)
  const [status, setStatus] = useState<StatusPedido>(pedido?.status ?? 'pendente')
  const [statusTocado, setStatusTocado] = useState(false)

  useEffect(() => {
    if (state?.success) onClose()
  }, [state, onClose])

  useEffect(() => {
    if (deleteState?.success) onClose()
  }, [deleteState, onClose])

  function handleValoresChange(nextTotal: number, nextPago: number) {
    setValorTotal(nextTotal)
    setValorPago(nextPago)
    if (!statusTocado) setStatus(sugerirStatus(nextTotal, nextPago))
  }

  const formId = pedido ? `pedido-form-${pedido.id}` : 'pedido-form-novo'

  return (
    <>
      <form id={formId} action={formAction} className="modal-fields">
        <div className="modal-row">
          <label>
            Data da venda
            <input type="date" name="data_venda" defaultValue={pedido?.data_venda ?? ''} required />
          </label>
          <label>
            Data do evento
            <input type="date" name="data_evento" defaultValue={pedido?.data_evento ?? ''} />
          </label>
          <label>
            Hora do evento
            <input type="time" name="hora_evento" defaultValue={pedido?.hora_evento?.slice(0, 5) ?? ''} />
          </label>
        </div>
        <label>
          Entidade
          <select name="entidade" defaultValue={pedido?.entidade ?? 'PF'}>
            {ENTIDADE_TIPOS.map((tipo) => (
              <option key={tipo} value={tipo}>
                {tipo}
              </option>
            ))}
          </select>
        </label>
        <label>
          Cliente
          <input type="text" name="cliente" defaultValue={pedido?.cliente ?? ''} placeholder="Nome do cliente" required />
        </label>
        <div className="modal-row">
          <label>
            Valor (R$)
            <input
              type="number"
              name="valor_total"
              step="0.01"
              min="0"
              placeholder="0,00"
              defaultValue={pedido?.valor_total ?? ''}
              required
              onChange={(e) => handleValoresChange(Number(e.target.value) || 0, valorPago)}
            />
          </label>
          <label>
            Valor já pago (R$)
            <input
              type="number"
              name="valor_pago"
              step="0.01"
              min="0"
              placeholder="0,00"
              defaultValue={pedido?.valor_pago ?? 0}
              onChange={(e) => handleValoresChange(valorTotal, Number(e.target.value) || 0)}
            />
          </label>
        </div>
        <div className="modal-row">
          <label>
            Emissão de nota
            <select name="emissao_nota" defaultValue={pedido?.emissao_nota ? 'S' : 'N'}>
              <option value="S">Sim</option>
              <option value="N">Não</option>
            </select>
          </label>
          <label>
            Status
            <select
              name="status"
              value={status}
              onChange={(e) => {
                setStatusTocado(true)
                setStatus(e.target.value as StatusPedido)
              }}
            >
              {STATUS_PEDIDO.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="modal-row">
          <label>
            Forma de pagamento
            <select name="forma_pagamento" defaultValue={pedido?.forma_pagamento ?? ''}>
              <option value="">-</option>
              {FORMAS_PAGAMENTO.map((fp) => (
                <option key={fp} value={fp}>
                  {fp}
                </option>
              ))}
            </select>
          </label>
          <label>
            Banco
            <input type="text" name="banco" placeholder="Ex: B. Brasil" defaultValue={pedido?.banco ?? ''} />
          </label>
        </div>
        <label>
          Data do pagamento
          <input type="date" name="data_pagamento" defaultValue={pedido?.data_pagamento ?? ''} />
        </label>
      </form>

      {state?.error && <p className="form-error" style={{ marginTop: 14 }}>{state.error}</p>}
      {deleteState?.error && <p className="form-error" style={{ marginTop: 14 }}>{deleteState.error}</p>}

      <div className="modal-footer">
        {pedido ? (
          <form action={deleteAction}>
            <DeleteButton />
          </form>
        ) : (
          <div />
        )}
        <div className="modal-footer-right">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <SaveButton formId={formId} />
        </div>
      </div>
    </>
  )
}
