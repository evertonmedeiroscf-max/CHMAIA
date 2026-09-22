'use client'

import { useEffect, useMemo, useState } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { ENTIDADE_TIPOS, STATUS_ORCAMENTO, type Orcamento, type Produto, type SecaoOrcamento, type StatusOrcamento } from '@/lib/types/domain'
import { calcularResumo } from '@/lib/utils/orcamento'
import OrcamentoItensEditor from './OrcamentoItensEditor'
import { createOrcamento, deleteOrcamento, updateOrcamento, type ActionState } from './actions'

const STATUS_LABEL: Record<StatusOrcamento, string> = {
  pendente: 'Pendente',
  aprovado: 'Aprovado',
  recusado: 'Recusado',
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

export default function OrcamentoForm({
  orcamento,
  produtos,
  onClose,
}: {
  orcamento?: Orcamento
  produtos: Produto[]
  onClose: () => void
}) {
  const action = useMemo(() => (orcamento ? updateOrcamento.bind(null, orcamento.id) : createOrcamento), [orcamento])
  const [state, formAction] = useFormState(action, undefined)
  const [deleteState, deleteAction] = useFormState(
    orcamento ? deleteOrcamento.bind(null, orcamento.id) : async (): Promise<ActionState> => undefined,
    undefined
  )

  const formId = orcamento ? `orcamento-form-${orcamento.id}` : 'orcamento-form-novo'
  const convertido = !!orcamento?.pedido_id

  const [secoes, setSecoes] = useState<SecaoOrcamento[]>(orcamento?.itens ?? [])
  const [percentualExtras, setPercentualExtras] = useState(orcamento?.percentual_extras ?? 0)
  const [numeroPessoas, setNumeroPessoas] = useState<number | null>(orcamento?.numero_pessoas ?? null)
  const [valorManual, setValorManual] = useState(orcamento?.valor_total ?? 0)
  const [mostrarItens, setMostrarItens] = useState((orcamento?.itens.length ?? 0) > 0)

  const resumo = calcularResumo(secoes, percentualExtras, numeroPessoas)
  const valorFinal = secoes.length ? resumo.valorTotal : valorManual

  useEffect(() => {
    if (state?.success) onClose()
  }, [state, onClose])

  useEffect(() => {
    if (deleteState?.success) onClose()
  }, [deleteState, onClose])

  return (
    <>
      <form id={formId} action={formAction} className="modal-fields">
        <input type="hidden" name="itens" value={JSON.stringify(secoes)} />
        <input type="hidden" name="percentual_extras" value={percentualExtras} />
        <div className="modal-row">
          <label>
            Data do orçamento
            <input
              type="date"
              name="data_orcamento"
              defaultValue={orcamento?.data_orcamento ?? new Date().toISOString().slice(0, 10)}
              required
            />
          </label>
          <label>
            Validade
            <input type="date" name="validade" defaultValue={orcamento?.validade ?? ''} />
          </label>
        </div>
        <label>
          Entidade
          <select name="entidade" defaultValue={orcamento?.entidade ?? 'PF'}>
            {ENTIDADE_TIPOS.map((tipo) => (
              <option key={tipo} value={tipo}>
                {tipo}
              </option>
            ))}
          </select>
        </label>
        <label>
          Cliente / Evento
          <input type="text" name="cliente" defaultValue={orcamento?.cliente ?? ''} placeholder="Nome do cliente ou evento" required />
        </label>
        <div className="modal-row">
          <label>
            Data do evento
            <input type="date" name="data_evento" defaultValue={orcamento?.data_evento ?? ''} />
          </label>
          <label>
            Hora do evento
            <input type="time" name="hora_evento" defaultValue={orcamento?.hora_evento?.slice(0, 5) ?? ''} />
          </label>
          <label>
            Nº de pessoas
            <input
              type="number"
              name="numero_pessoas"
              min="1"
              value={numeroPessoas ?? ''}
              onChange={(e) => setNumeroPessoas(e.target.value ? Number(e.target.value) : null)}
            />
          </label>
        </div>
        <label>
          Descrição do evento
          <input
            type="text"
            name="descricao"
            defaultValue={orcamento?.descricao ?? ''}
            placeholder="Ex: Saída às 18h - das 19h às 22:30h"
          />
        </label>
        <div className="modal-row">
          <label>
            Valor (R$) {!!secoes.length && <span className="text-muted">— calculado pelos itens</span>}
            <input
              type="number"
              name="valor_total"
              step="0.01"
              min="0"
              placeholder="0,00"
              value={valorFinal || ''}
              readOnly={!!secoes.length}
              onChange={(e) => setValorManual(Number(e.target.value) || 0)}
              required
            />
          </label>
          <label>
            Status
            <select name="status" defaultValue={orcamento?.status ?? 'pendente'} disabled={convertido}>
              {STATUS_ORCAMENTO.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
        </div>
        {convertido && (
          <p className="modal-item-label">Este orçamento já foi convertido em pedido — o status não pode mais ser alterado aqui.</p>
        )}
      </form>

      <div style={{ marginTop: 16 }}>
        {mostrarItens ? (
          <OrcamentoItensEditor
            secoes={secoes}
            onChangeSecoes={setSecoes}
            percentualExtras={percentualExtras}
            onChangePercentualExtras={setPercentualExtras}
            numeroPessoas={numeroPessoas}
            produtos={produtos}
          />
        ) : (
          <button type="button" className="btn-secondary" onClick={() => setMostrarItens(true)}>
            + Detalhar itens do orçamento (cardápio e serviço)
          </button>
        )}
      </div>

      {state?.error && <p className="form-error" style={{ marginTop: 14 }}>{state.error}</p>}
      {deleteState?.error && <p className="form-error" style={{ marginTop: 14 }}>{deleteState.error}</p>}

      <div className="modal-footer">
        {orcamento ? (
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
