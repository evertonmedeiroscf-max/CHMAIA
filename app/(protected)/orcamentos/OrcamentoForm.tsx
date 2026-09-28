'use client'

import { useEffect, useMemo, useState } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { ENTIDADE_LABEL, ENTIDADE_TIPOS, STATUS_ORCAMENTO, type EntidadeTipo, type Orcamento, type Produto, type SecaoOrcamento, type StatusOrcamento } from '@/lib/types/domain'
import { format } from 'date-fns'
import {
  calcularResumo,
  calcularValidade,
  DIAS_VALIDADE_ORCAMENTO,
  PERCENTUAL_EXTRAS_PADRAO,
  planilhaModelo,
} from '@/lib/utils/orcamento'
import { formatDateBR } from '@/lib/utils/format'
import OrcamentoItensEditor from './OrcamentoItensEditor'
import { createOrcamento, deleteOrcamento, restaurarOrcamento, updateOrcamento, type ActionState } from './actions'

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

function RestoreButton() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className="btn-secondary" disabled={pending}>
      {pending ? 'Restaurando...' : 'Restaurar orçamento'}
    </button>
  )
}

export default function OrcamentoForm({
  orcamento,
  produtos,
  onClose,
  onSalvo,
  recemSalvo = false,
}: {
  orcamento?: Orcamento
  produtos: Produto[]
  onClose: () => void
  // Chamado após salvar (em vez de fechar): a lista reabre o orçamento já
  // salvo, com o botão "Gerar proposta" ao lado de "Salvar".
  onSalvo?: (id: string) => void
  recemSalvo?: boolean
}) {
  const action = useMemo(() => (orcamento ? updateOrcamento.bind(null, orcamento.id) : createOrcamento), [orcamento])
  const [state, formAction] = useFormState(action, undefined)
  const excluido = !!orcamento?.excluido_em
  const [deleteState, deleteAction] = useFormState(
    orcamento
      ? (excluido ? restaurarOrcamento : deleteOrcamento).bind(null, orcamento.id)
      : async (): Promise<ActionState> => undefined,
    undefined
  )

  const formId = orcamento ? `orcamento-form-${orcamento.id}` : 'orcamento-form-novo'
  const convertido = !!orcamento?.pedido_id

  const [secoes, setSecoes] = useState<SecaoOrcamento[]>(orcamento?.itens ?? [])
  const [entidade, setEntidade] = useState<EntidadeTipo>(orcamento?.entidade ?? 'PF')
  const [percentualExtras, setPercentualExtras] = useState(
    orcamento?.percentual_extras ?? PERCENTUAL_EXTRAS_PADRAO[orcamento?.entidade ?? 'PF']
  )
  // Enquanto o % não for mexido à mão, trocar PF/PJ troca o % para o padrão
  // do novo tipo. Orçamento já salvo mantém o % gravado.
  const [extrasAlterado, setExtrasAlterado] = useState(!!orcamento)
  const [numeroPessoas, setNumeroPessoas] = useState<number | null>(orcamento?.numero_pessoas ?? null)
  const [valorManual, setValorManual] = useState(orcamento?.valor_total ?? 0)
  const [mostrarItens, setMostrarItens] = useState((orcamento?.itens.length ?? 0) > 0)
  // Data local (não UTC): à noite, toISOString() já cairia no dia seguinte.
  const [dataOrcamento, setDataOrcamento] = useState(orcamento?.data_orcamento ?? format(new Date(), 'yyyy-MM-dd'))
  const validade = calcularValidade(dataOrcamento)

  const resumo = calcularResumo(secoes, percentualExtras, numeroPessoas)
  const valorFinal = secoes.length ? resumo.valorTotal : valorManual

  useEffect(() => {
    if (!state?.success) return
    if (onSalvo && state.id) onSalvo(state.id)
    else onClose()
  }, [state, onClose, onSalvo])
  const salvo = recemSalvo || !!state?.success

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
              value={dataOrcamento}
              onChange={(e) => setDataOrcamento(e.target.value)}
              required
            />
          </label>
          <label>
            Validade <span className="text-muted">— {DIAS_VALIDADE_ORCAMENTO} dias após o orçamento</span>
            <input type="date" name="validade" value={validade ?? ''} readOnly tabIndex={-1} title={validade ? `Válido até ${formatDateBR(validade)}` : undefined} />
          </label>
        </div>
        <label>
          Entidade
          <select
            name="entidade"
            value={entidade}
            onChange={(e) => {
              const nova = e.target.value as EntidadeTipo
              setEntidade(nova)
              if (!extrasAlterado) setPercentualExtras(PERCENTUAL_EXTRAS_PADRAO[nova])
            }}
          >
            {ENTIDADE_TIPOS.map((tipo) => (
              <option key={tipo} value={tipo}>
                {ENTIDADE_LABEL[tipo]}
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
            Valor (R$) {!!secoes.length && <span className="text-muted">— igual ao total da planilha</span>}
            <input
              type="number"
              name="valor_total"
              step="0.01"
              min="0"
              placeholder="0,00"
              value={valorFinal || ''}
              readOnly={!!secoes.length}
              onChange={(e) => setValorManual(Number(e.target.value) || 0)}
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
        {excluido && (
          <p className="form-error">
            Orçamento excluído em {new Date(orcamento!.excluido_em!).toLocaleDateString('pt-BR')}. Ele continua na lista, realçado em
            vermelho — use &quot;Restaurar orçamento&quot; para reativá-lo.
          </p>
        )}
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
            onChangePercentualExtras={(valor) => {
              setPercentualExtras(valor)
              setExtrasAlterado(true)
            }}
            numeroPessoas={numeroPessoas}
            produtos={produtos}
          />
        ) : (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setSecoes(planilhaModelo())
                setMostrarItens(true)
              }}
            >
              Montar planilha do orçamento (modelo)
            </button>
            <button type="button" className="btn-secondary" onClick={() => setMostrarItens(true)}>
              Planilha em branco
            </button>
          </div>
        )}
      </div>

      {state?.error && <p className="form-error" style={{ marginTop: 14 }}>{state.error}</p>}
      {deleteState?.error && <p className="form-error" style={{ marginTop: 14 }}>{deleteState.error}</p>}

      <div className="modal-footer">
        {orcamento ? (
          <form
            action={deleteAction}
            onSubmit={(e) => {
              if (!excluido && !confirm(`Excluir o orçamento nº ${orcamento.numero}? Ele continua na lista, realçado em vermelho.`)) {
                e.preventDefault()
              }
            }}
          >
            {excluido ? <RestoreButton /> : <DeleteButton />}
          </form>
        ) : (
          <div />
        )}
        <div className="modal-footer-right">
          {salvo && <span className="orcamento-salvo">✓ Orçamento salvo</span>}
          <button type="button" className="btn-secondary" onClick={onClose}>
            {orcamento ? 'Fechar' : 'Cancelar'}
          </button>
          <SaveButton formId={formId} />
          {orcamento && !excluido && (
            <a
              href={`/proposta/${orcamento.id}`}
              target="_blank"
              rel="noopener"
              className="btn-proposta"
              title="Abre a proposta para o cliente em uma nova aba (imprimir ou salvar em PDF). Usa os dados já salvos."
            >
              Gerar proposta
            </a>
          )}
        </div>
      </div>
    </>
  )
}
