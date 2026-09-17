'use client'

import { useEffect, useMemo } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { CATEGORIAS_ESTOQUE, UNIDADES_MEDIDA, type EstoqueItem } from '@/lib/types/domain'
import { createEstoqueItem, deleteEstoqueItem, updateEstoqueItem, type ActionState } from './actions'

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

export default function ItemForm({ item, onClose }: { item?: EstoqueItem; onClose: () => void }) {
  const action = useMemo(() => (item ? updateEstoqueItem.bind(null, item.id) : createEstoqueItem), [item])
  const [state, formAction] = useFormState(action, undefined)
  const [deleteState, deleteAction] = useFormState(
    item ? deleteEstoqueItem.bind(null, item.id) : async (): Promise<ActionState> => undefined,
    undefined
  )

  useEffect(() => {
    if (state?.success) onClose()
  }, [state, onClose])

  useEffect(() => {
    if (deleteState?.success) onClose()
  }, [deleteState, onClose])

  const formId = item ? `item-form-${item.id}` : 'item-form-novo'

  return (
    <>
      <form id={formId} action={formAction} className="modal-fields">
        <label>
          Nome do item
          <input type="text" name="nome" placeholder="Ex: Queijo Muçarela" defaultValue={item?.nome ?? ''} required />
        </label>
        <label>
          Categoria
          <select name="categoria" defaultValue={item?.categoria ?? CATEGORIAS_ESTOQUE[0]}>
            {CATEGORIAS_ESTOQUE.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label>
          Unidade
          <select name="unidade_medida" defaultValue={item?.unidade_medida ?? UNIDADES_MEDIDA[0]}>
            {UNIDADES_MEDIDA.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </label>
        <div className="modal-row">
          {!item && (
            <label>
              Qtd. atual
              <input type="number" name="quantidade_atual" step="0.01" min="0" defaultValue={0} />
            </label>
          )}
          <label>
            Qtd. mínima
            <input type="number" name="quantidade_minima" step="0.01" min="0" defaultValue={item?.quantidade_minima ?? 0} />
          </label>
        </div>
        {item && (
          <p className="modal-item-label">
            Quantidade atual: <strong>{item.quantidade_atual}</strong> (ajuste pelo registro de movimentos)
          </p>
        )}
      </form>

      {state?.error && <p className="form-error" style={{ marginTop: 14 }}>{state.error}</p>}
      {deleteState?.error && <p className="form-error" style={{ marginTop: 14 }}>{deleteState.error}</p>}

      <div className="modal-footer">
        {item ? (
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
