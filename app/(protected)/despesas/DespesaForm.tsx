'use client'

import { useEffect, useMemo } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { CATEGORIAS_DESPESA, FORMAS_PAGAMENTO, type Despesa } from '@/lib/types/domain'
import { createDespesa, deleteDespesa, updateDespesa, type ActionState } from './actions'

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

export default function DespesaForm({ despesa, onClose }: { despesa?: Despesa; onClose: () => void }) {
  const action = useMemo(() => (despesa ? updateDespesa.bind(null, despesa.id) : createDespesa), [despesa])
  const [state, formAction] = useFormState(action, undefined)
  const [deleteState, deleteAction] = useFormState(
    despesa ? deleteDespesa.bind(null, despesa.id) : async (): Promise<ActionState> => undefined,
    undefined
  )

  useEffect(() => {
    if (state?.success) onClose()
  }, [state, onClose])

  useEffect(() => {
    if (deleteState?.success) onClose()
  }, [deleteState, onClose])

  const formId = despesa ? `despesa-form-${despesa.id}` : 'despesa-form-nova'

  return (
    <>
      <form id={formId} action={formAction} className="modal-fields">
        <div className="modal-row">
          <label>
            Data
            <input type="date" name="data" defaultValue={despesa?.data ?? ''} required />
          </label>
          <label>
            Categoria
            <select name="categoria" defaultValue={despesa?.categoria ?? CATEGORIAS_DESPESA[0]}>
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
            defaultValue={despesa?.descricao ?? ''}
            required
          />
        </label>
        <div className="modal-row">
          <label>
            Valor (R$)
            <input type="number" name="valor" step="0.01" min="0" placeholder="0,00" defaultValue={despesa?.valor ?? ''} required />
          </label>
          <label>
            Pagamento
            <select name="forma_pagamento" defaultValue={despesa?.forma_pagamento ?? FORMAS_PAGAMENTO[0]}>
              {FORMAS_PAGAMENTO.map((fp) => (
                <option key={fp} value={fp}>
                  {fp}
                </option>
              ))}
            </select>
          </label>
        </div>
      </form>

      {state?.error && <p className="form-error" style={{ marginTop: 14 }}>{state.error}</p>}
      {deleteState?.error && <p className="form-error" style={{ marginTop: 14 }}>{deleteState.error}</p>}

      <div className="modal-footer">
        {despesa ? (
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
