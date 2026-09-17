'use client'

import { cloneElement, useMemo, useState } from 'react'
import ColumnManagerPanel, { type ColumnManagerColumn } from '@/components/ColumnManagerPanel'
import Modal from '@/components/Modal'
import NotaFiscalForm from './NotaFiscalForm'
import type { FormaPagamento, NotaFiscalComPedido, Pedido } from '@/lib/types/domain'
import { formatCurrency, formatDateBR } from '@/lib/utils/format'
import { computeRowMinWidth } from '@/lib/utils/columns'
import { useColumnPrefs } from '@/lib/hooks/useColumnPrefs'

function hojeISO() {
  return new Date().toISOString().slice(0, 10)
}

function categoriaNota(n: NotaFiscalComPedido): 'sim' | 'nao' | 'canceladas' {
  if (n.cancelada) return 'canceladas'
  return n.pago ? 'sim' : 'nao'
}

const COLUMN_LABELS: Record<string, string> = {
  numero_nota: 'Nº NOTA',
  pedido_numero: 'VENDA',
  pedido_data_venda: 'DATA VENDA',
  pedido_cliente: 'CLIENTE',
  valor: 'VALOR',
  valor_pago: 'PAGO (R$)',
  falta_pagar: 'FALTA',
  data_emissao: 'EMISSÃO NF',
  previsao_pagamento: 'PREVISÃO PGTO',
  pago: 'PAGO',
  forma_pagamento: 'FORMA',
  banco: 'BANCO',
  data_pagamento: 'DT PG',
}

const COLUMN_WIDTHS: Record<string, string> = {
  numero_nota: '90px',
  pedido_numero: '90px',
  pedido_data_venda: '120px',
  pedido_cliente: '1fr',
  valor: '110px',
  valor_pago: '110px',
  falta_pagar: '110px',
  data_emissao: '120px',
  previsao_pagamento: '120px',
  pago: '130px',
  forma_pagamento: '160px',
  banco: '120px',
  data_pagamento: '120px',
}

const DEFAULT_ORDER = Object.keys(COLUMN_LABELS)
const ACAO_WIDTH = '70px'

export default function NotasFiscaisClient({
  notas,
  pedidos,
}: {
  notas: NotaFiscalComPedido[]
  pedidos: Pedido[]
}) {
  const [filtroCliente, setFiltroCliente] = useState<string[]>([])
  const [filtroForma, setFiltroForma] = useState<string[]>([])
  const [filtroPago, setFiltroPago] = useState<string[]>([])
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<NotaFiscalComPedido | undefined>(undefined)

  const { order, isVisible, toggleVisible, reorder } = useColumnPrefs('colunas:notas-fiscais', DEFAULT_ORDER)

  const opcoesCliente = useMemo(
    () =>
      Array.from(new Set(notas.map((n) => n.pedido_cliente)))
        .sort()
        .map((c) => ({ value: c, label: c })),
    [notas]
  )
  const opcoesForma = useMemo(
    () =>
      Array.from(new Set(notas.map((n) => n.forma_pagamento).filter((v): v is FormaPagamento => !!v)))
        .sort()
        .map((f) => ({ value: f, label: f })),
    [notas]
  )

  const notasFiltradas = useMemo(() => {
    return notas
      .filter((n) => !filtroCliente.length || filtroCliente.includes(n.pedido_cliente))
      .filter((n) => !filtroForma.length || filtroForma.includes(n.forma_pagamento ?? ''))
      .filter((n) => !filtroPago.length || filtroPago.includes(categoriaNota(n)))
      .sort((a, b) => (b.data_emissao ?? '').localeCompare(a.data_emissao ?? ''))
  }, [notas, filtroCliente, filtroForma, filtroPago])

  const columns: ColumnManagerColumn[] = [
    { key: 'numero_nota', label: COLUMN_LABELS.numero_nota },
    { key: 'pedido_numero', label: COLUMN_LABELS.pedido_numero },
    { key: 'pedido_data_venda', label: COLUMN_LABELS.pedido_data_venda },
    { key: 'pedido_cliente', label: COLUMN_LABELS.pedido_cliente, filter: { options: opcoesCliente, selected: filtroCliente, onChange: setFiltroCliente } },
    { key: 'valor', label: COLUMN_LABELS.valor },
    { key: 'valor_pago', label: COLUMN_LABELS.valor_pago },
    { key: 'falta_pagar', label: COLUMN_LABELS.falta_pagar },
    { key: 'data_emissao', label: COLUMN_LABELS.data_emissao },
    { key: 'previsao_pagamento', label: COLUMN_LABELS.previsao_pagamento },
    {
      key: 'pago',
      label: COLUMN_LABELS.pago,
      filter: {
        options: [
          { value: 'sim', label: 'Pagas' },
          { value: 'nao', label: 'Não pagas' },
          { value: 'canceladas', label: 'Canceladas' },
        ],
        selected: filtroPago,
        onChange: setFiltroPago,
      },
    },
    { key: 'forma_pagamento', label: COLUMN_LABELS.forma_pagamento, filter: { options: opcoesForma, selected: filtroForma, onChange: setFiltroForma } },
    { key: 'banco', label: COLUMN_LABELS.banco },
    { key: 'data_pagamento', label: COLUMN_LABELS.data_pagamento },
  ]

  const visibleOrder = order.filter(isVisible)
  const gridTemplate = [...visibleOrder.map((k) => COLUMN_WIDTHS[k]), ACAO_WIDTH].join(' ')
  const minWidth = computeRowMinWidth([...visibleOrder.map((k) => COLUMN_WIDTHS[k]), ACAO_WIDTH], 200)

  function abrirNova() {
    setEditando(undefined)
    setModalAberto(true)
  }

  function abrirEdicao(nota: NotaFiscalComPedido) {
    setEditando(nota)
    setModalAberto(true)
  }

  function renderCell(key: string, n: NotaFiscalComPedido) {
    switch (key) {
      case 'numero_nota':
        return <div className="col-center text-muted">{n.numero_nota ?? '-'}</div>
      case 'pedido_numero':
        return <div className="col-center text-muted">{n.pedido_numero}</div>
      case 'pedido_data_venda':
        return <div className="col-center text-muted">{formatDateBR(n.pedido_data_venda)}</div>
      case 'pedido_cliente':
        return <div className="col-center text-strong">{n.pedido_cliente}</div>
      case 'valor':
        return <div className="col-center">{formatCurrency(n.valor)}</div>
      case 'valor_pago':
        return <div className="col-center text-muted">{formatCurrency(n.valor_pago)}</div>
      case 'falta_pagar':
        return (
          <div className={`col-center${n.falta_pagar > 0 ? ' valor-falta-positiva' : ' text-muted'}`}>
            {formatCurrency(n.falta_pagar)}
          </div>
        )
      case 'data_emissao':
        return <div className="col-center text-muted">{n.data_emissao ? formatDateBR(n.data_emissao) : '-'}</div>
      case 'previsao_pagamento':
        return <div className="col-center text-muted">{n.previsao_pagamento ? formatDateBR(n.previsao_pagamento) : '-'}</div>
      case 'pago':
        return (
          <div className="col-center">
            {n.cancelada ? (
              <span className="badge badge-pendente">CANCELAR NOTA</span>
            ) : (
              <span className={`badge ${n.pago ? 'badge-pago' : 'badge-pendente'}`}>{n.pago ? 'PG' : 'PENDENTE'}</span>
            )}
          </div>
        )
      case 'forma_pagamento':
        return <div className="col-center text-muted">{n.forma_pagamento ?? ''}</div>
      case 'banco':
        return <div className="col-center text-muted">{n.banco ?? ''}</div>
      case 'data_pagamento':
        return <div className="col-center text-muted">{n.data_pagamento ? formatDateBR(n.data_pagamento) : '-'}</div>
      default:
        return <div />
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Relatório de Notas Fiscais</h1>
        <button type="button" className="btn-primary" onClick={abrirNova} disabled={pedidos.length === 0}>
          Editar nota
        </button>
      </div>

      {pedidos.length === 0 && (
        <p className="form-info" style={{ marginBottom: 16 }}>
          Cadastre um pedido antes de emitir uma nota fiscal.
        </p>
      )}

      <div className="toolbar" style={{ justifyContent: 'flex-end' }}>
        <ColumnManagerPanel columns={columns} order={order} isVisible={isVisible} onToggleVisible={toggleVisible} onReorder={reorder} />
      </div>

      <div className="data-table table-scroll">
        <div className="table-row table-head" style={{ gridTemplateColumns: gridTemplate, minWidth }}>
          {visibleOrder.map((key) => (
            <div key={key} className="col-center">
              {COLUMN_LABELS[key]}
            </div>
          ))}
          <div></div>
        </div>

        {notasFiltradas.map((n) => {
          const vencida = !n.cancelada && !n.pago && !!n.previsao_pagamento && n.previsao_pagamento < hojeISO()
          return (
            <div key={n.id} className={`table-row${vencida ? ' row-alert' : ''}`} style={{ gridTemplateColumns: gridTemplate, minWidth }}>
              {visibleOrder.map((key) => cloneElement(renderCell(key, n), { key }))}
              <div className="col-center">
                <button type="button" className="action-link" onClick={() => abrirEdicao(n)}>
                  editar
                </button>
              </div>
            </div>
          )
        })}

        {notasFiltradas.length === 0 && <div className="empty-state">Nenhuma nota fiscal encontrada.</div>}
      </div>

      {modalAberto && (
        <Modal title={editando ? 'Editar nota fiscal' : 'Nova nota fiscal'} onClose={() => setModalAberto(false)}>
          <NotaFiscalForm
            key={editando?.id ?? 'nova'}
            nota={editando}
            pedidos={pedidos}
            onClose={() => setModalAberto(false)}
          />
        </Modal>
      )}
    </div>
  )
}
