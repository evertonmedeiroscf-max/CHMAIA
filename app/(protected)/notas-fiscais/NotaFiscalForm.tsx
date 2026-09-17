'use client'

import { useEffect, useMemo, useState } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import type { NotaFiscalComPedido, Pedido } from '@/lib/types/domain'
import { addDaysISO, formatCurrency, formatDateBR } from '@/lib/utils/format'
import { createNotaFiscal, deleteNotaFiscal, updateNotaFiscal, type ActionState } from './actions'

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

// Linha "rótulo: valor" somente leitura — usada para os campos que só podem
// ser alterados editando o pedido em Pedidos.
function CampoSomenteLeitura({ label, value }: { label: string; value: string }) {
  return (
    <div className="computed-field">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

export default function NotaFiscalForm({
  nota,
  pedidos,
  onClose,
}: {
  nota?: NotaFiscalComPedido
  pedidos: Pedido[]
  onClose: () => void
}) {
  const isEdicao = !!nota
  const action = useMemo(() => (nota ? updateNotaFiscal.bind(null, nota.id) : createNotaFiscal), [nota])
  const [state, formAction] = useFormState(action, undefined)
  const [deleteState, deleteAction] = useFormState(
    nota ? deleteNotaFiscal.bind(null, nota.id) : async (): Promise<ActionState> => undefined,
    undefined
  )

  const [pedidoId, setPedidoId] = useState(pedidos[0]?.id ?? '')
  const [cancelada, setCancelada] = useState(nota?.cancelada ?? false)
  const [dataEmissao, setDataEmissao] = useState(nota?.data_emissao ?? '')

  const pedidoSelecionado = useMemo(() => pedidos.find((p) => p.id === pedidoId), [pedidos, pedidoId])
  const previsaoPagamento = dataEmissao ? addDaysISO(dataEmissao, 15) : null

  useEffect(() => {
    if (state?.success) onClose()
  }, [state, onClose])

  useEffect(() => {
    if (deleteState?.success) onClose()
  }, [deleteState, onClose])

  const formId = nota ? `nota-form-${nota.id}` : 'nota-form-nova'

  // Dados vindos do pedido — só leitura aqui, independente de estar
  // criando (prévia do pedido selecionado) ou editando (dados da nota já
  // sincronizados pelo trigger).
  const resumo = isEdicao
    ? {
        vendaLabel: `Nº ${nota!.pedido_numero} — ${nota!.pedido_cliente}`,
        dataVenda: nota!.pedido_data_venda,
        valor: nota!.valor,
        valorPago: nota!.valor_pago,
        falta: nota!.falta_pagar,
        pago: nota!.pago,
        forma: nota!.forma_pagamento,
        banco: nota!.banco,
        dataPagamento: nota!.data_pagamento,
      }
    : pedidoSelecionado
      ? {
          vendaLabel: `Nº ${pedidoSelecionado.numero} — ${pedidoSelecionado.cliente}`,
          dataVenda: pedidoSelecionado.data_venda,
          valor: pedidoSelecionado.valor_total,
          valorPago: pedidoSelecionado.valor_pago,
          falta: pedidoSelecionado.falta_pagar,
          pago: pedidoSelecionado.status === 'pago',
          forma: pedidoSelecionado.forma_pagamento,
          banco: pedidoSelecionado.banco,
          dataPagamento: pedidoSelecionado.data_pagamento,
        }
      : null

  return (
    <>
      <form id={formId} action={formAction} className="modal-fields">
        {isEdicao ? (
          <input type="hidden" name="pedido_id" value={nota!.pedido_id} />
        ) : (
          <label>
            Venda
            <select name="pedido_id" value={pedidoId} onChange={(e) => setPedidoId(e.target.value)} required>
              {pedidos.map((p) => (
                <option key={p.id} value={p.id}>
                  Nº {p.numero} — {p.cliente}
                </option>
              ))}
            </select>
          </label>
        )}

        {resumo && (
          <>
            {isEdicao && <CampoSomenteLeitura label="Venda" value={resumo.vendaLabel} />}
            <div className="modal-row">
              <CampoSomenteLeitura label="Data da venda" value={formatDateBR(resumo.dataVenda)} />
              <CampoSomenteLeitura label="Valor" value={formatCurrency(resumo.valor)} />
            </div>
            <div className="modal-row">
              <CampoSomenteLeitura label="Valor já pago" value={formatCurrency(resumo.valorPago)} />
              <CampoSomenteLeitura label="Falta pagar" value={formatCurrency(resumo.falta)} />
            </div>
            <div className="modal-row">
              <CampoSomenteLeitura label="Pago" value={resumo.pago ? 'Sim' : 'Não'} />
              <CampoSomenteLeitura label="Forma de pagamento" value={resumo.forma ?? '-'} />
            </div>
            <div className="modal-row">
              <CampoSomenteLeitura label="Banco" value={resumo.banco ?? '-'} />
              <CampoSomenteLeitura label="Data do pagamento" value={resumo.dataPagamento ? formatDateBR(resumo.dataPagamento) : '-'} />
            </div>
            <p className="modal-item-label">Esses dados só mudam editando o pedido em Pedidos.</p>
          </>
        )}

        <div className="modal-row">
          <label>
            Nº nota
            <input type="text" name="numero_nota" placeholder="Ex: 940" defaultValue={nota?.numero_nota ?? ''} />
          </label>
          <label>
            Data de emissão NF
            <input
              type="date"
              name="data_emissao"
              defaultValue={nota?.data_emissao ?? ''}
              onChange={(e) => setDataEmissao(e.target.value)}
            />
          </label>
        </div>

        <CampoSomenteLeitura
          label="Previsão de pagamento (emissão + 15 dias)"
          value={previsaoPagamento ? formatDateBR(previsaoPagamento) : '-'}
        />

        {isEdicao && (
          <label>
            Nota cancelada
            <select name="cancelada" value={cancelada ? 'S' : 'N'} onChange={(e) => setCancelada(e.target.value === 'S')}>
              <option value="N">Não</option>
              <option value="S">Sim</option>
            </select>
          </label>
        )}
      </form>

      {state?.error && <p className="form-error" style={{ marginTop: 14 }}>{state.error}</p>}
      {deleteState?.error && <p className="form-error" style={{ marginTop: 14 }}>{deleteState.error}</p>}

      <div className="modal-footer">
        {nota ? (
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
