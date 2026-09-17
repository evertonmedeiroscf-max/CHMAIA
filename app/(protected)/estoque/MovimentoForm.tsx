'use client'

import { useEffect } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import type { EstoqueItem } from '@/lib/types/domain'
import { registrarMovimento, type ActionState } from './actions'

function SaveButton() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'Salvando...' : 'Salvar'}
    </button>
  )
}

export default function MovimentoForm({ item, onClose }: { item: EstoqueItem; onClose: () => void }) {
  const [state, formAction] = useFormState<ActionState, FormData>(registrarMovimento.bind(null, item.id), undefined)

  useEffect(() => {
    if (state?.success) onClose()
  }, [state, onClose])

  const hoje = new Date().toISOString().slice(0, 10)

  return (
    <>
      <form action={formAction} className="modal-fields">
        <p className="modal-item-label">
          Item: <strong>{item.nome}</strong>
        </p>
        <div className="modal-row">
          <label>
            Tipo
            <select name="tipo" defaultValue="entrada">
              <option value="entrada">Entrada</option>
              <option value="saida">Saída</option>
            </select>
          </label>
          <label>
            Data
            <input type="date" name="data" defaultValue={hoje} required />
          </label>
        </div>
        <label>
          Quantidade
          <input type="number" name="quantidade" step="0.01" min="0.01" required />
        </label>
        <label>
          Motivo
          <input type="text" name="motivo" placeholder="Ex: Compra fornecedor / Uso em evento" />
        </label>
      </form>

      {state?.error && <p className="form-error" style={{ marginTop: 14 }}>{state.error}</p>}

      <div className="modal-footer">
        <div />
        <div className="modal-footer-right">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <SaveButton />
        </div>
      </div>
    </>
  )
}
