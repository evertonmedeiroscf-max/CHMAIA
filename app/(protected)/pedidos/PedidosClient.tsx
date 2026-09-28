'use client'

import { cloneElement, useEffect, useMemo, useState } from 'react'
import ColumnHeaderFilter from '@/components/ColumnHeaderFilter'
import ColumnManagerPanel, { type ColumnManagerColumn } from '@/components/ColumnManagerPanel'
import Modal from '@/components/Modal'
import Pagination from '@/components/Pagination'
import PedidosCalendar from './PedidosCalendar'
import PedidoForm from './PedidoForm'
import { ENTIDADE_LABEL, ENTIDADE_TIPOS, STATUS_PEDIDO, type FormaPagamento, type Pedido } from '@/lib/types/domain'
import { formatCurrency, formatDateBR } from '@/lib/utils/format'
import { computeRowMinWidth } from '@/lib/utils/columns'
import { useColumnPrefs } from '@/lib/hooks/useColumnPrefs'
import { updateDataPagamentoPedido, updateFormaPagamentoPedido } from './actions'

type ViewMode = 'lista' | 'calendario'

const CATEGORIAS_PAGAMENTO = ['Pix', 'Transferência', 'Cartão', 'Dinheiro'] as const

function categoriaPagamento(forma: FormaPagamento | null): string {
  switch (forma) {
    case 'Pix':
      return 'Pix'
    case 'Transferência bancária':
      return 'Transferência'
    case 'Cartão de débito':
    case 'Cartão de crédito':
      return 'Cartão'
    case 'Dinheiro':
      return 'Dinheiro'
    default:
      return ''
  }
}

// "Cartão" cobre débito e crédito — ao trocar direto na linha, mantém o tipo
// de cartão já usado no pedido (se houver) em vez de forçar um dos dois.
function categoriaParaForma(categoria: string, atual: FormaPagamento | null): FormaPagamento | null {
  switch (categoria) {
    case 'Pix':
      return 'Pix'
    case 'Transferência':
      return 'Transferência bancária'
    case 'Dinheiro':
      return 'Dinheiro'
    case 'Cartão':
      return atual === 'Cartão de crédito' ? 'Cartão de crédito' : 'Cartão de débito'
    default:
      return null
  }
}

const STATUS_LABEL: Record<string, string> = {
  pendente: 'PENDENTE',
  '50% pago': '50% PAGO',
  pago: 'PAGO',
}

const STATUS_BADGE_CLASS: Record<string, string> = {
  pendente: 'badge-pendente',
  '50% pago': 'badge-50pago',
  pago: 'badge-pago',
}

const COLUMN_LABELS: Record<string, string> = {
  numero: 'Nº',
  data_venda: 'DATA DA VENDA',
  data_evento: 'DATA DO EVENTO',
  hora_evento: 'HORA DO EVENTO',
  cliente: 'CLIENTE',
  valor_total: 'VALOR',
  valor_pago: 'VALOR JÁ PAGO',
  falta_pagar: 'FALTA',
  emissao_nota: 'NOTA',
  entidade: 'ENT.',
  forma_pagamento: 'PAGAMENTO',
  banco: 'BANCO',
  data_pagamento: 'DT PAGAMENTO',
  status: 'STATUS',
}

const COLUMN_WIDTHS: Record<string, string> = {
  numero: '44px',
  data_venda: '110px',
  data_evento: '110px',
  hora_evento: '100px',
  cliente: '1fr',
  valor_total: '100px',
  valor_pago: '100px',
  falta_pagar: '100px',
  emissao_nota: '55px',
  entidade: '55px',
  forma_pagamento: '130px',
  banco: '120px',
  data_pagamento: '130px',
  status: '100px',
}

const DEFAULT_ORDER = Object.keys(COLUMN_LABELS)
const ACAO_WIDTH = '70px'
const ITENS_POR_PAGINA = 15

export default function PedidosClient({ pedidos }: { pedidos: Pedido[] }) {
  const [viewMode, setViewMode] = useState<ViewMode>('lista')
  const [filtroNumero, setFiltroNumero] = useState<string[]>([])
  const [filtroDataInicio, setFiltroDataInicio] = useState('')
  const [filtroDataFim, setFiltroDataFim] = useState('')
  const [filtroDataEventoInicio, setFiltroDataEventoInicio] = useState('')
  const [filtroDataEventoFim, setFiltroDataEventoFim] = useState('')
  const [filtroHoraEvento, setFiltroHoraEvento] = useState<string[]>([])
  const [filtroCliente, setFiltroCliente] = useState<string[]>([])
  const [filtroValorTotal, setFiltroValorTotal] = useState<string[]>([])
  const [filtroValorPago, setFiltroValorPago] = useState<string[]>([])
  const [filtroFaltaPagar, setFiltroFaltaPagar] = useState<string[]>([])
  const [filtroNota, setFiltroNota] = useState<string[]>([])
  const [filtroEntidade, setFiltroEntidade] = useState<string[]>([])
  const [filtroFormaPagamento, setFiltroFormaPagamento] = useState<string[]>([])
  const [filtroBanco, setFiltroBanco] = useState<string[]>([])
  const [filtroDataPagamentoInicio, setFiltroDataPagamentoInicio] = useState('')
  const [filtroDataPagamentoFim, setFiltroDataPagamentoFim] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<string[]>([])
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<Pedido | undefined>(undefined)
  const [paginaAtual, setPaginaAtual] = useState(1)

  const { order, isVisible, toggleVisible, reorder } = useColumnPrefs('colunas:pedidos', DEFAULT_ORDER)

  const opcoesCliente = useMemo(
    () =>
      Array.from(new Set(pedidos.map((p) => p.cliente)))
        .sort()
        .map((c) => ({ value: c, label: c })),
    [pedidos]
  )
  const opcoesFormaPagamento = CATEGORIAS_PAGAMENTO.map((c) => ({ value: c, label: c }))

  function opcoesTexto(getter: (p: Pedido) => string | null) {
    return Array.from(new Set(pedidos.map(getter).filter((v): v is string => !!v)))
      .sort((a, b) => a.localeCompare(b, 'pt-BR'))
      .map((v) => ({ value: v, label: v }))
  }
  function opcoesNumero(getter: (p: Pedido) => number | null, formatar: (v: number) => string) {
    return Array.from(new Set(pedidos.map(getter).filter((v): v is number => v !== null && v !== undefined)))
      .sort((a, b) => a - b)
      .map((v) => ({ value: String(v), label: formatar(v) }))
  }

  const opcoesNumeroPedido = useMemo(() => opcoesNumero((p) => p.numero, (v) => String(v)), [pedidos])
  const opcoesHoraEvento = useMemo(() => opcoesTexto((p) => (p.hora_evento ? p.hora_evento.slice(0, 5) : null)), [pedidos])
  const opcoesValorTotal = useMemo(() => opcoesNumero((p) => p.valor_total, formatCurrency), [pedidos])
  const opcoesValorPago = useMemo(() => opcoesNumero((p) => p.valor_pago, formatCurrency), [pedidos])
  const opcoesFaltaPagar = useMemo(() => opcoesNumero((p) => p.falta_pagar, formatCurrency), [pedidos])
  const opcoesBanco = useMemo(() => opcoesTexto((p) => p.banco), [pedidos])

  const pedidosFiltrados = useMemo(() => {
    return pedidos.filter((p) => {
      if (filtroNumero.length && !filtroNumero.includes(String(p.numero))) return false
      if (filtroDataInicio && p.data_venda < filtroDataInicio) return false
      if (filtroDataFim && p.data_venda > filtroDataFim) return false
      if (filtroDataEventoInicio && (p.data_evento ?? '') < filtroDataEventoInicio) return false
      if (filtroDataEventoFim && !(p.data_evento && p.data_evento <= filtroDataEventoFim)) return false
      if (filtroHoraEvento.length && !filtroHoraEvento.includes(p.hora_evento ? p.hora_evento.slice(0, 5) : '')) return false
      if (filtroCliente.length && !filtroCliente.includes(p.cliente)) return false
      if (filtroValorTotal.length && !filtroValorTotal.includes(String(p.valor_total))) return false
      if (filtroValorPago.length && !filtroValorPago.includes(String(p.valor_pago))) return false
      if (filtroFaltaPagar.length && !filtroFaltaPagar.includes(String(p.falta_pagar))) return false
      if (filtroNota.length && !filtroNota.includes(p.emissao_nota ? 'S' : 'N')) return false
      if (filtroEntidade.length && !filtroEntidade.includes(p.entidade)) return false
      if (filtroFormaPagamento.length && !filtroFormaPagamento.includes(categoriaPagamento(p.forma_pagamento))) return false
      if (filtroBanco.length && !filtroBanco.includes(p.banco ?? '')) return false
      if (filtroDataPagamentoInicio && !(p.data_pagamento && p.data_pagamento >= filtroDataPagamentoInicio)) return false
      if (filtroDataPagamentoFim && !(p.data_pagamento && p.data_pagamento <= filtroDataPagamentoFim)) return false
      if (filtroStatus.length && !filtroStatus.includes(p.status)) return false
      return true
    })
  }, [
    pedidos,
    filtroNumero,
    filtroDataInicio,
    filtroDataFim,
    filtroDataEventoInicio,
    filtroDataEventoFim,
    filtroHoraEvento,
    filtroCliente,
    filtroValorTotal,
    filtroValorPago,
    filtroFaltaPagar,
    filtroNota,
    filtroEntidade,
    filtroFormaPagamento,
    filtroBanco,
    filtroDataPagamentoInicio,
    filtroDataPagamentoFim,
    filtroStatus,
  ])

  // Volta pra primeira página sempre que o filtro muda o conjunto de
  // resultados — sem isso, dava pra ficar "preso" numa página vazia.
  useEffect(() => {
    setPaginaAtual(1)
  }, [pedidosFiltrados])

  const totalPaginas = Math.max(1, Math.ceil(pedidosFiltrados.length / ITENS_POR_PAGINA))
  const pedidosPaginados = useMemo(
    () => pedidosFiltrados.slice((paginaAtual - 1) * ITENS_POR_PAGINA, paginaAtual * ITENS_POR_PAGINA),
    [pedidosFiltrados, paginaAtual]
  )

  const columns: ColumnManagerColumn[] = [
    { key: 'numero', label: COLUMN_LABELS.numero, filter: { options: opcoesNumeroPedido, selected: filtroNumero, onChange: setFiltroNumero } },
    {
      key: 'data_venda',
      label: COLUMN_LABELS.data_venda,
      dateRangeFilter: { from: filtroDataInicio, to: filtroDataFim, onChangeFrom: setFiltroDataInicio, onChangeTo: setFiltroDataFim },
    },
    {
      key: 'data_evento',
      label: COLUMN_LABELS.data_evento,
      dateRangeFilter: {
        from: filtroDataEventoInicio,
        to: filtroDataEventoFim,
        onChangeFrom: setFiltroDataEventoInicio,
        onChangeTo: setFiltroDataEventoFim,
      },
    },
    { key: 'hora_evento', label: COLUMN_LABELS.hora_evento, filter: { options: opcoesHoraEvento, selected: filtroHoraEvento, onChange: setFiltroHoraEvento } },
    { key: 'cliente', label: COLUMN_LABELS.cliente, filter: { options: opcoesCliente, selected: filtroCliente, onChange: setFiltroCliente } },
    { key: 'valor_total', label: COLUMN_LABELS.valor_total, filter: { options: opcoesValorTotal, selected: filtroValorTotal, onChange: setFiltroValorTotal } },
    { key: 'valor_pago', label: COLUMN_LABELS.valor_pago, filter: { options: opcoesValorPago, selected: filtroValorPago, onChange: setFiltroValorPago } },
    { key: 'falta_pagar', label: COLUMN_LABELS.falta_pagar, filter: { options: opcoesFaltaPagar, selected: filtroFaltaPagar, onChange: setFiltroFaltaPagar } },
    {
      key: 'emissao_nota',
      label: COLUMN_LABELS.emissao_nota,
      filter: {
        options: [
          { value: 'S', label: 'Sim' },
          { value: 'N', label: 'Não' },
        ],
        selected: filtroNota,
        onChange: setFiltroNota,
      },
    },
    {
      key: 'entidade',
      label: COLUMN_LABELS.entidade,
      filter: { options: ENTIDADE_TIPOS.map((t) => ({ value: t, label: ENTIDADE_LABEL[t] })), selected: filtroEntidade, onChange: setFiltroEntidade },
    },
    {
      key: 'forma_pagamento',
      label: COLUMN_LABELS.forma_pagamento,
      filter: { options: opcoesFormaPagamento, selected: filtroFormaPagamento, onChange: setFiltroFormaPagamento },
    },
    { key: 'banco', label: COLUMN_LABELS.banco, filter: { options: opcoesBanco, selected: filtroBanco, onChange: setFiltroBanco } },
    {
      key: 'data_pagamento',
      label: COLUMN_LABELS.data_pagamento,
      dateRangeFilter: {
        from: filtroDataPagamentoInicio,
        to: filtroDataPagamentoFim,
        onChangeFrom: setFiltroDataPagamentoInicio,
        onChangeTo: setFiltroDataPagamentoFim,
      },
    },
    {
      key: 'status',
      label: COLUMN_LABELS.status,
      filter: {
        options: STATUS_PEDIDO.map((s) => ({ value: s, label: STATUS_LABEL[s] })),
        selected: filtroStatus,
        onChange: setFiltroStatus,
      },
    },
  ]

  const columnsByKey = new Map(columns.map((c) => [c.key, c]))
  const visibleOrder = order.filter(isVisible)
  const gridTemplate = [...visibleOrder.map((k) => COLUMN_WIDTHS[k]), ACAO_WIDTH].join(' ')
  const minWidth = computeRowMinWidth([...visibleOrder.map((k) => COLUMN_WIDTHS[k]), ACAO_WIDTH])

  function abrirNovo() {
    setEditando(undefined)
    setModalAberto(true)
  }

  function abrirEdicao(pedido: Pedido) {
    setEditando(pedido)
    setModalAberto(true)
  }

  function fecharModal() {
    setModalAberto(false)
  }

  async function handleChangeFormaPagamento(pedido: Pedido, categoria: string) {
    const novaForma = categoriaParaForma(categoria, pedido.forma_pagamento)
    if (!novaForma || novaForma === pedido.forma_pagamento) return
    await updateFormaPagamentoPedido(pedido.id, novaForma)
  }

  async function handleChangeDataPagamento(pedido: Pedido, data: string) {
    const novaData = data || null
    if (novaData === pedido.data_pagamento) return
    await updateDataPagamentoPedido(pedido.id, novaData)
  }

  function renderCell(key: string, p: Pedido) {
    switch (key) {
      case 'numero':
        return <div className="col-center text-muted">{p.numero}</div>
      case 'data_venda':
        return <div className="col-center text-muted">{formatDateBR(p.data_venda)}</div>
      case 'data_evento':
        return <div className="col-center text-muted">{p.data_evento ? formatDateBR(p.data_evento) : '-'}</div>
      case 'hora_evento':
        return <div className="col-center text-muted">{p.hora_evento ? p.hora_evento.slice(0, 5) : '-'}</div>
      case 'cliente':
        return <div className="col-center text-strong">{p.cliente}</div>
      case 'valor_total':
        return <div className="col-center">{formatCurrency(p.valor_total)}</div>
      case 'valor_pago':
        return <div className="col-center text-muted">{formatCurrency(p.valor_pago)}</div>
      case 'falta_pagar':
        return (
          <div className={`col-center${p.falta_pagar > 0 ? ' valor-falta-positiva' : ' text-muted'}`}>
            {formatCurrency(p.falta_pagar)}
          </div>
        )
      case 'emissao_nota':
        return <div className="col-center text-muted">{p.emissao_nota ? 'S' : 'N'}</div>
      case 'entidade':
        return <div className="col-center text-muted">{p.entidade}</div>
      case 'forma_pagamento':
        return (
          <div className="col-center">
            <select
              className="select-control"
              style={{ width: '100%' }}
              value={categoriaPagamento(p.forma_pagamento)}
              onChange={(e) => handleChangeFormaPagamento(p, e.target.value)}
            >
              <option value="" disabled hidden>
                -
              </option>
              {CATEGORIAS_PAGAMENTO.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        )
      case 'banco':
        return <div className="col-center text-muted">{p.banco ?? '-'}</div>
      case 'data_pagamento':
        return (
          <div className="col-center">
            <input
              type="date"
              className="select-control"
              style={{ width: '100%' }}
              value={p.data_pagamento ?? ''}
              onChange={(e) => handleChangeDataPagamento(p, e.target.value)}
            />
          </div>
        )
      case 'status':
        return (
          <div className="col-center">
            <span className={`badge ${STATUS_BADGE_CLASS[p.status]}`}>{STATUS_LABEL[p.status]}</span>
          </div>
        )
      default:
        return <div />
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Pedidos</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <div className="view-toggle">
            <button type="button" className={viewMode === 'lista' ? 'active' : ''} onClick={() => setViewMode('lista')}>
              Lista
            </button>
            <button
              type="button"
              className={viewMode === 'calendario' ? 'active' : ''}
              onClick={() => setViewMode('calendario')}
            >
              Calendário
            </button>
          </div>
          <button type="button" className="btn-primary" onClick={abrirNovo}>
            + Novo pedido
          </button>
        </div>
      </div>

      {viewMode === 'calendario' && <PedidosCalendar pedidos={pedidosFiltrados} onEdit={abrirEdicao} />}

      {viewMode === 'lista' && (
        <>
          <div className="toolbar" style={{ justifyContent: 'flex-end' }}>
            <ColumnManagerPanel columns={columns} order={order} isVisible={isVisible} onToggleVisible={toggleVisible} onReorder={reorder} />
          </div>

          <div className="data-table table-scroll">
            <div className="table-row table-head" style={{ gridTemplateColumns: gridTemplate, minWidth }}>
              {visibleOrder.map((key) => {
                const col = columnsByKey.get(key)
                return (
                  <div key={key} className="col-filter">
                    <span>{COLUMN_LABELS[key]}</span>
                    <ColumnHeaderFilter filter={col?.filter} dateRangeFilter={col?.dateRangeFilter} />
                  </div>
                )
              })}
              <div></div>
            </div>

            {pedidosPaginados.map((p) => (
              <div key={p.id} className="table-row" style={{ gridTemplateColumns: gridTemplate, minWidth }}>
                {visibleOrder.map((key) => cloneElement(renderCell(key, p), { key }))}
                <div className="col-center">
                  <button type="button" className="action-link" onClick={() => abrirEdicao(p)}>
                    editar
                  </button>
                </div>
              </div>
            ))}

            {pedidosFiltrados.length === 0 && <div className="empty-state">Nenhum pedido encontrado.</div>}
          </div>

          <Pagination
            paginaAtual={paginaAtual}
            totalPaginas={totalPaginas}
            totalItens={pedidosFiltrados.length}
            itensPorPagina={ITENS_POR_PAGINA}
            onChange={setPaginaAtual}
          />
        </>
      )}

      {modalAberto && (
        <Modal title={editando ? 'Editar pedido' : 'Novo pedido'} onClose={fecharModal}>
          <PedidoForm key={editando?.id ?? 'novo'} pedido={editando} onClose={fecharModal} />
        </Modal>
      )}
    </div>
  )
}
