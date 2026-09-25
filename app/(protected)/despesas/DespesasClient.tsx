'use client'

import { cloneElement, useEffect, useMemo, useState } from 'react'
import ColumnManagerPanel, { type ColumnManagerColumn } from '@/components/ColumnManagerPanel'
import Modal from '@/components/Modal'
import Pagination from '@/components/Pagination'
import DespesaForm from './DespesaForm'
import ImportarDespesa from './ImportarDespesa'
import { CATEGORIAS_DESPESA, type Despesa, type FormaPagamento } from '@/lib/types/domain'
import { formatCurrency, formatDateBR } from '@/lib/utils/format'
import { computeRowMinWidth } from '@/lib/utils/columns'
import { useColumnPrefs } from '@/lib/hooks/useColumnPrefs'

const COLUMN_LABELS: Record<string, string> = {
  data: 'DATA',
  descricao: 'DESCRIÇÃO',
  categoria: 'CATEGORIA',
  forma_pagamento: 'PAGAMENTO',
  valor: 'VALOR',
}

const COLUMN_WIDTHS: Record<string, string> = {
  data: '90px',
  descricao: '1fr',
  categoria: '160px',
  forma_pagamento: '130px',
  valor: '120px',
}

const DEFAULT_ORDER = Object.keys(COLUMN_LABELS)
const ACAO_WIDTH = '70px'
const ITENS_POR_PAGINA = 15

export default function DespesasClient({ despesas }: { despesas: Despesa[] }) {
  const [filtroDataInicio, setFiltroDataInicio] = useState('')
  const [filtroDataFim, setFiltroDataFim] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState<string[]>([])
  const [filtroFormaPagamento, setFiltroFormaPagamento] = useState<string[]>([])
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<Despesa | undefined>(undefined)
  const [paginaAtual, setPaginaAtual] = useState(1)

  const { order, isVisible, toggleVisible, reorder } = useColumnPrefs('colunas:despesas', DEFAULT_ORDER)

  const opcoesFormaPagamento = useMemo(
    () =>
      Array.from(new Set(despesas.map((d) => d.forma_pagamento).filter((v): v is FormaPagamento => !!v)))
        .sort()
        .map((f) => ({ value: f, label: f })),
    [despesas]
  )

  const despesasFiltradas = useMemo(() => {
    return despesas
      .filter((d) => !filtroDataInicio || d.data >= filtroDataInicio)
      .filter((d) => !filtroDataFim || d.data <= filtroDataFim)
      .filter((d) => !filtroCategoria.length || filtroCategoria.includes(d.categoria))
      .filter((d) => !filtroFormaPagamento.length || filtroFormaPagamento.includes(d.forma_pagamento ?? ''))
      .sort((a, b) => b.data.localeCompare(a.data))
  }, [despesas, filtroDataInicio, filtroDataFim, filtroCategoria, filtroFormaPagamento])

  useEffect(() => {
    setPaginaAtual(1)
  }, [despesasFiltradas])

  const totalPaginas = Math.max(1, Math.ceil(despesasFiltradas.length / ITENS_POR_PAGINA))
  const despesasPaginadas = useMemo(
    () => despesasFiltradas.slice((paginaAtual - 1) * ITENS_POR_PAGINA, paginaAtual * ITENS_POR_PAGINA),
    [despesasFiltradas, paginaAtual]
  )

  const columns: ColumnManagerColumn[] = [
    {
      key: 'data',
      label: COLUMN_LABELS.data,
      dateRangeFilter: { from: filtroDataInicio, to: filtroDataFim, onChangeFrom: setFiltroDataInicio, onChangeTo: setFiltroDataFim },
    },
    { key: 'descricao', label: COLUMN_LABELS.descricao },
    {
      key: 'categoria',
      label: COLUMN_LABELS.categoria,
      filter: { options: CATEGORIAS_DESPESA.map((c) => ({ value: c, label: c })), selected: filtroCategoria, onChange: setFiltroCategoria },
    },
    {
      key: 'forma_pagamento',
      label: COLUMN_LABELS.forma_pagamento,
      filter: { options: opcoesFormaPagamento, selected: filtroFormaPagamento, onChange: setFiltroFormaPagamento },
    },
    { key: 'valor', label: COLUMN_LABELS.valor },
  ]

  const visibleOrder = order.filter(isVisible)
  const gridTemplate = [...visibleOrder.map((k) => COLUMN_WIDTHS[k]), ACAO_WIDTH].join(' ')
  const minWidth = computeRowMinWidth([...visibleOrder.map((k) => COLUMN_WIDTHS[k]), ACAO_WIDTH])

  function abrirNova() {
    setEditando(undefined)
    setModalAberto(true)
  }

  function abrirEdicao(despesa: Despesa) {
    setEditando(despesa)
    setModalAberto(true)
  }

  function renderCell(key: string, d: Despesa) {
    switch (key) {
      case 'data':
        return <div className="col-center text-muted">{formatDateBR(d.data)}</div>
      case 'descricao':
        return <div className="text-strong">{d.descricao}</div>
      case 'categoria':
        return <div className="col-center text-muted">{d.categoria}</div>
      case 'forma_pagamento':
        return <div className="col-center text-muted">{d.forma_pagamento ?? ''}</div>
      case 'valor':
        return (
          <div className="col-center" style={{ fontWeight: 600, color: 'var(--danger)' }}>
            - {formatCurrency(d.valor)}
          </div>
        )
      default:
        return <div />
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Despesas</h1>
        <button type="button" className="btn-primary" onClick={abrirNova}>
          + Nova despesa
        </button>
      </div>

      <div className="toolbar" style={{ justifyContent: 'flex-end' }}>
        <ImportarDespesa />
        <ColumnManagerPanel columns={columns} order={order} isVisible={isVisible} onToggleVisible={toggleVisible} onReorder={reorder} />
      </div>

      <div className="data-table table-scroll">
        <div className="table-row table-head" style={{ gridTemplateColumns: gridTemplate, minWidth }}>
          {visibleOrder.map((key) => (
            <div key={key} className={key === 'descricao' ? undefined : 'col-center'}>
              {COLUMN_LABELS[key]}
            </div>
          ))}
          <div></div>
        </div>
        {despesasPaginadas.map((d) => (
          <div key={d.id} className="table-row" style={{ gridTemplateColumns: gridTemplate, minWidth }}>
            {visibleOrder.map((key) => cloneElement(renderCell(key, d), { key }))}
            <div className="col-center">
              <button type="button" className="action-link" onClick={() => abrirEdicao(d)}>
                editar
              </button>
            </div>
          </div>
        ))}
        {despesasFiltradas.length === 0 && <div className="empty-state">Nenhuma despesa encontrada.</div>}
      </div>

      <Pagination
        paginaAtual={paginaAtual}
        totalPaginas={totalPaginas}
        totalItens={despesasFiltradas.length}
        itensPorPagina={ITENS_POR_PAGINA}
        onChange={setPaginaAtual}
      />

      {modalAberto && (
        <Modal title={editando ? 'Editar despesa' : 'Nova despesa'} onClose={() => setModalAberto(false)}>
          <DespesaForm key={editando?.id ?? 'nova'} despesa={editando} onClose={() => setModalAberto(false)} />
        </Modal>
      )}
    </div>
  )
}
