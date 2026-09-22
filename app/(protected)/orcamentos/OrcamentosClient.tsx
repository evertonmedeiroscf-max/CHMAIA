'use client'

import { cloneElement, useMemo, useState, useTransition } from 'react'
import ColumnManagerPanel, { type ColumnManagerColumn } from '@/components/ColumnManagerPanel'
import Modal from '@/components/Modal'
import OrcamentoForm from './OrcamentoForm'
import { ENTIDADE_TIPOS, STATUS_ORCAMENTO, type Orcamento, type Produto } from '@/lib/types/domain'
import { formatCurrency, formatDateBR } from '@/lib/utils/format'
import { computeRowMinWidth } from '@/lib/utils/columns'
import { useColumnPrefs } from '@/lib/hooks/useColumnPrefs'
import { converterEmPedido } from './actions'

const STATUS_LABEL: Record<string, string> = {
  pendente: 'PENDENTE',
  aprovado: 'APROVADO',
  recusado: 'RECUSADO',
}

// Reaproveita as cores já existentes: aprovado ~ pago (verde), pendente ~
// 50% pago (âmbar, neutro), recusado ~ pendente de pedido (vermelho).
const STATUS_BADGE_CLASS: Record<string, string> = {
  pendente: 'badge-50pago',
  aprovado: 'badge-pago',
  recusado: 'badge-pendente',
}

const COLUMN_LABELS: Record<string, string> = {
  numero: 'Nº',
  data_orcamento: 'DATA DO ORÇAMENTO',
  cliente: 'CLIENTE',
  entidade: 'ENT.',
  data_evento: 'DATA DO EVENTO',
  hora_evento: 'HORA DO EVENTO',
  descricao: 'DESCRIÇÃO',
  numero_pessoas: 'PESSOAS',
  valor_total: 'VALOR',
  valor_por_pessoa: 'VALOR/PESSOA',
  validade: 'VALIDADE',
  status: 'STATUS',
}

const COLUMN_WIDTHS: Record<string, string> = {
  numero: '44px',
  data_orcamento: '130px',
  cliente: '1fr',
  entidade: '55px',
  data_evento: '110px',
  hora_evento: '100px',
  descricao: '1fr',
  numero_pessoas: '90px',
  valor_total: '110px',
  valor_por_pessoa: '110px',
  validade: '110px',
  status: '100px',
}

const DEFAULT_ORDER = Object.keys(COLUMN_LABELS)
const ACAO_WIDTH = '150px'

export default function OrcamentosClient({ orcamentos, produtos }: { orcamentos: Orcamento[]; produtos: Produto[] }) {
  const [filtroDataInicio, setFiltroDataInicio] = useState('')
  const [filtroDataFim, setFiltroDataFim] = useState('')
  const [filtroCliente, setFiltroCliente] = useState<string[]>([])
  const [filtroEntidade, setFiltroEntidade] = useState<string[]>([])
  const [filtroStatus, setFiltroStatus] = useState<string[]>([])
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<Orcamento | undefined>(undefined)
  const [convertendoId, setConvertendoId] = useState<string | null>(null)
  const [erroConversao, setErroConversao] = useState('')
  const [, startTransition] = useTransition()

  const { order, isVisible, toggleVisible, reorder } = useColumnPrefs('colunas:orcamentos', DEFAULT_ORDER)

  const opcoesCliente = useMemo(
    () =>
      Array.from(new Set(orcamentos.map((o) => o.cliente)))
        .sort()
        .map((c) => ({ value: c, label: c })),
    [orcamentos]
  )

  const orcamentosFiltrados = useMemo(() => {
    return orcamentos
      .filter((o) => !filtroDataInicio || o.data_orcamento >= filtroDataInicio)
      .filter((o) => !filtroDataFim || o.data_orcamento <= filtroDataFim)
      .filter((o) => !filtroCliente.length || filtroCliente.includes(o.cliente))
      .filter((o) => !filtroEntidade.length || filtroEntidade.includes(o.entidade))
      .filter((o) => !filtroStatus.length || filtroStatus.includes(o.status))
      .sort((a, b) => b.data_orcamento.localeCompare(a.data_orcamento) || b.numero - a.numero)
  }, [orcamentos, filtroDataInicio, filtroDataFim, filtroCliente, filtroEntidade, filtroStatus])

  const columns: ColumnManagerColumn[] = [
    { key: 'numero', label: COLUMN_LABELS.numero },
    {
      key: 'data_orcamento',
      label: COLUMN_LABELS.data_orcamento,
      dateRangeFilter: { from: filtroDataInicio, to: filtroDataFim, onChangeFrom: setFiltroDataInicio, onChangeTo: setFiltroDataFim },
    },
    { key: 'cliente', label: COLUMN_LABELS.cliente, filter: { options: opcoesCliente, selected: filtroCliente, onChange: setFiltroCliente } },
    {
      key: 'entidade',
      label: COLUMN_LABELS.entidade,
      filter: { options: ENTIDADE_TIPOS.map((t) => ({ value: t, label: t })), selected: filtroEntidade, onChange: setFiltroEntidade },
    },
    { key: 'data_evento', label: COLUMN_LABELS.data_evento },
    { key: 'hora_evento', label: COLUMN_LABELS.hora_evento },
    { key: 'descricao', label: COLUMN_LABELS.descricao },
    { key: 'numero_pessoas', label: COLUMN_LABELS.numero_pessoas },
    { key: 'valor_total', label: COLUMN_LABELS.valor_total },
    { key: 'valor_por_pessoa', label: COLUMN_LABELS.valor_por_pessoa },
    { key: 'validade', label: COLUMN_LABELS.validade },
    {
      key: 'status',
      label: COLUMN_LABELS.status,
      filter: {
        options: STATUS_ORCAMENTO.map((s) => ({ value: s, label: STATUS_LABEL[s] })),
        selected: filtroStatus,
        onChange: setFiltroStatus,
      },
    },
  ]

  const visibleOrder = order.filter(isVisible)
  const gridTemplate = [...visibleOrder.map((k) => COLUMN_WIDTHS[k]), ACAO_WIDTH].join(' ')
  const minWidth = computeRowMinWidth([...visibleOrder.map((k) => COLUMN_WIDTHS[k]), ACAO_WIDTH])

  function abrirNovo() {
    setEditando(undefined)
    setModalAberto(true)
  }

  function abrirEdicao(orcamento: Orcamento) {
    setEditando(orcamento)
    setModalAberto(true)
  }

  function converter(orcamento: Orcamento) {
    setErroConversao('')
    setConvertendoId(orcamento.id)
    startTransition(async () => {
      const resultado = await converterEmPedido(orcamento.id)
      setConvertendoId(null)
      if (resultado?.error) setErroConversao(resultado.error)
    })
  }

  function renderCell(key: string, o: Orcamento) {
    switch (key) {
      case 'numero':
        return <div className="col-center text-muted">{o.numero}</div>
      case 'data_orcamento':
        return <div className="col-center text-muted">{formatDateBR(o.data_orcamento)}</div>
      case 'cliente':
        return <div className="col-center text-strong">{o.cliente}</div>
      case 'entidade':
        return <div className="col-center text-muted">{o.entidade}</div>
      case 'data_evento':
        return <div className="col-center text-muted">{o.data_evento ? formatDateBR(o.data_evento) : '-'}</div>
      case 'hora_evento':
        return <div className="col-center text-muted">{o.hora_evento ? o.hora_evento.slice(0, 5) : '-'}</div>
      case 'descricao':
        return <div className="text-muted">{o.descricao ?? '-'}</div>
      case 'numero_pessoas':
        return <div className="col-center text-muted">{o.numero_pessoas ?? '-'}</div>
      case 'valor_total':
        return <div className="col-center">{formatCurrency(o.valor_total)}</div>
      case 'valor_por_pessoa':
        return (
          <div className="col-center text-muted">
            {o.numero_pessoas ? formatCurrency(o.valor_total / o.numero_pessoas) : '-'}
          </div>
        )
      case 'validade':
        return <div className="col-center text-muted">{o.validade ? formatDateBR(o.validade) : '-'}</div>
      case 'status':
        return (
          <div className="col-center">
            <span className={`badge ${STATUS_BADGE_CLASS[o.status]}`}>{STATUS_LABEL[o.status]}</span>
          </div>
        )
      default:
        return <div />
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Orçamentos</h1>
        <button type="button" className="btn-primary" onClick={abrirNovo}>
          + Novo orçamento
        </button>
      </div>

      <p className="modal-item-label" style={{ marginBottom: 16 }}>
        Cadastre a proposta enviada ao cliente. Quando ele aceitar, marque como <strong>aprovado</strong> e use
        &quot;converter em pedido&quot; para gerar o Pedido automaticamente, sem digitar tudo de novo.
      </p>

      <div className="toolbar" style={{ justifyContent: 'flex-end' }}>
        <ColumnManagerPanel columns={columns} order={order} isVisible={isVisible} onToggleVisible={toggleVisible} onReorder={reorder} />
      </div>

      {erroConversao && (
        <p className="form-error" style={{ marginBottom: 12 }}>
          {erroConversao}
        </p>
      )}

      <div className="data-table table-scroll">
        <div className="table-row table-head" style={{ gridTemplateColumns: gridTemplate, minWidth }}>
          {visibleOrder.map((key) => (
            <div key={key} className={key === 'descricao' ? undefined : 'col-center'}>
              {COLUMN_LABELS[key]}
            </div>
          ))}
          <div></div>
        </div>

        {orcamentosFiltrados.map((o) => (
          <div key={o.id} className="table-row" style={{ gridTemplateColumns: gridTemplate, minWidth }}>
            {visibleOrder.map((key) => cloneElement(renderCell(key, o), { key }))}
            <div className="col-center" style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button type="button" className="action-link" onClick={() => abrirEdicao(o)}>
                editar
              </button>
              {o.pedido_id ? (
                <span className="text-muted" style={{ fontSize: 12 }}>
                  pedido gerado
                </span>
              ) : o.status === 'aprovado' ? (
                <button type="button" className="action-link primary" disabled={convertendoId === o.id} onClick={() => converter(o)}>
                  {convertendoId === o.id ? 'convertendo...' : 'converter em pedido'}
                </button>
              ) : null}
            </div>
          </div>
        ))}

        {orcamentosFiltrados.length === 0 && <div className="empty-state">Nenhum orçamento encontrado.</div>}
      </div>

      {modalAberto && (
        <Modal title={editando ? 'Editar orçamento' : 'Novo orçamento'} onClose={() => setModalAberto(false)}>
          <OrcamentoForm key={editando?.id ?? 'novo'} orcamento={editando} produtos={produtos} onClose={() => setModalAberto(false)} />
        </Modal>
      )}
    </div>
  )
}
