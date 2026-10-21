'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { ENTIDADE_LABEL, ENTIDADE_TIPOS, FORMAS_PAGAMENTO, STATUS_PEDIDO, type Pedido, type StatusPedido } from '@/lib/types/domain'
import { createPedido, deletePedido, updatePedido, type ActionState } from './actions'
import AvisoPedidoDuplicado from './AvisoPedidoDuplicado'

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

function SaveButton({ formId, salvando }: { formId: string; salvando: boolean }) {
  const { pending } = useFormStatus()
  const ocupado = pending || salvando
  return (
    <button type="submit" form={formId} className="btn-primary" disabled={ocupado}>
      {ocupado ? 'Salvando...' : 'Salvar'}
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

  // Pedido em duplicidade: o servidor devolve `duplicados` sem salvar; a tela
  // mostra o aviso e troca "Salvar" por "Salvar mesmo assim", que reenvia o
  // formulário com `confirmar_duplicado=1`.
  //
  // O envio é manual (onSubmit + startTransition) em vez de `<form action>`
  // porque o React 19 LIMPA os campos de um `<form action>` depois da resposta
  // do servidor — o aviso (ou um erro de validação) apagaria tudo que o usuário
  // digitou. `salvando` (a transição pendente) também impede clique duplo, que
  // criaria o pedido duas vezes.
  const formRef = useRef<HTMLFormElement>(null)
  const confirmarRef = useRef<HTMLInputElement>(null)
  const [salvando, iniciarEnvio] = useTransition()
  const [mostrarAviso, setMostrarAviso] = useState(false)
  // Trava imediata (o estado `salvando` só chega no próximo render): dois envios
  // no mesmo instante criariam o pedido duas vezes.
  const enviandoRef = useRef(false)

  useEffect(() => {
    if (!salvando) enviandoRef.current = false
  }, [salvando])

  useEffect(() => {
    if (state?.success) onClose()
  }, [state, onClose])

  useEffect(() => {
    enviandoRef.current = false
    if (!state) return
    // A confirmação vale só pra UM envio: se algo mais der errado, pede de novo.
    if (confirmarRef.current) confirmarRef.current.value = ''
    setMostrarAviso(!!state.duplicados?.length)
  }, [state])

  function limparConfirmacao() {
    if (confirmarRef.current) confirmarRef.current.value = ''
    setMostrarAviso(false)
  }

  function salvarMesmoAssim() {
    if (!confirmarRef.current || !formRef.current) return
    confirmarRef.current.value = '1'
    formRef.current.requestSubmit()
  }

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
      <form
        id={formId}
        ref={formRef}
        className="modal-fields"
        onSubmit={(e) => {
          e.preventDefault()
          if (salvando || enviandoRef.current) return
          enviandoRef.current = true
          const dados = new FormData(e.currentTarget)
          iniciarEnvio(() => formAction(dados))
        }}
        onChange={limparConfirmacao}
      >
        <input ref={confirmarRef} type="hidden" name="confirmar_duplicado" defaultValue="" />
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
                {ENTIDADE_LABEL[tipo]}
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

      {mostrarAviso && state?.duplicados && <AvisoPedidoDuplicado duplicados={state.duplicados} />}
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
          {mostrarAviso ? (
            <button type="button" className="btn-primary" onClick={salvarMesmoAssim} disabled={salvando}>
              {salvando ? 'Salvando...' : 'Salvar mesmo assim'}
            </button>
          ) : (
            <SaveButton formId={formId} salvando={salvando} />
          )}
        </div>
      </div>
    </>
  )
}
