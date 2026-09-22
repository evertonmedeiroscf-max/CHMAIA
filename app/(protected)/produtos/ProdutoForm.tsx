'use client'

import { useEffect, useMemo } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { TIPOS_PRODUTO, type Produto } from '@/lib/types/domain'
import { createProduto, deleteProduto, updateProduto, type ActionState } from './actions'

const TIPO_LABEL: Record<string, string> = {
  comida: 'Comida (com peso)',
  servico: 'Serviço (sem peso)',
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

export default function ProdutoForm({ produto, onClose }: { produto?: Produto; onClose: () => void }) {
  const action = useMemo(() => (produto ? updateProduto.bind(null, produto.id) : createProduto), [produto])
  const [state, formAction] = useFormState(action, undefined)
  const [deleteState, deleteAction] = useFormState(
    produto ? deleteProduto.bind(null, produto.id) : async (): Promise<ActionState> => undefined,
    undefined
  )

  const formId = produto ? `produto-form-${produto.id}` : 'produto-form-novo'

  useEffect(() => {
    if (state?.success) onClose()
  }, [state, onClose])

  useEffect(() => {
    if (deleteState?.success) onClose()
  }, [deleteState, onClose])

  return (
    <>
      <form id={formId} action={formAction} className="modal-fields">
        <label>
          Nome
          <input type="text" name="nome" defaultValue={produto?.nome ?? ''} placeholder="Ex: Salgados forno" required />
        </label>
        <div className="modal-row">
          <label>
            Tipo
            <select name="tipo" defaultValue={produto?.tipo ?? 'comida'}>
              {TIPOS_PRODUTO.map((t) => (
                <option key={t} value={t}>
                  {TIPO_LABEL[t]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Categoria
            <input type="text" name="categoria" defaultValue={produto?.categoria ?? ''} placeholder="Ex: Salgados" />
          </label>
        </div>
        <div className="modal-row">
          <label>
            Peso padrão (Kg)
            <input type="number" name="peso_kg_padrao" step="0.001" min="0" defaultValue={produto?.peso_kg_padrao ?? ''} />
          </label>
          <label>
            Valor unitário (R$)
            <input
              type="number"
              name="valor_unit_padrao"
              step="0.01"
              min="0"
              defaultValue={produto?.valor_unit_padrao ?? ''}
              required
            />
          </label>
        </div>
        <label>
          Ativo
          <select name="ativo" defaultValue={produto?.ativo === false ? 'N' : 'S'}>
            <option value="S">Sim</option>
            <option value="N">Não (não aparece mais no seletor do catálogo)</option>
          </select>
        </label>
      </form>

      {state?.error && <p className="form-error" style={{ marginTop: 14 }}>{state.error}</p>}
      {deleteState?.error && <p className="form-error" style={{ marginTop: 14 }}>{deleteState.error}</p>}

      <div className="modal-footer">
        {produto ? (
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
