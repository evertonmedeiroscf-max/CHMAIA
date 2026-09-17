'use client'

import { cloneElement, useMemo, useState } from 'react'
import Link from 'next/link'
import ColumnManagerPanel, { type ColumnManagerColumn } from '@/components/ColumnManagerPanel'
import Modal from '@/components/Modal'
import ItemForm from './ItemForm'
import MovimentoForm from './MovimentoForm'
import { CATEGORIAS_ESTOQUE, UNIDADES_MEDIDA, type EstoqueItem } from '@/lib/types/domain'
import { computeRowMinWidth } from '@/lib/utils/columns'
import { useColumnPrefs } from '@/lib/hooks/useColumnPrefs'

const COLUMN_LABELS: Record<string, string> = {
  nome: 'ITEM',
  categoria: 'CATEGORIA',
  unidade_medida: 'UNIDADE',
  quantidade_atual: 'ATUAL',
  quantidade_minima: 'MÍNIMO',
}

const COLUMN_WIDTHS: Record<string, string> = {
  nome: '1fr',
  categoria: '150px',
  unidade_medida: '110px',
  quantidade_atual: '110px',
  quantidade_minima: '110px',
}

const DEFAULT_ORDER = Object.keys(COLUMN_LABELS)
const ACAO_WIDTH = '120px'

type ModalState = { type: 'item'; item?: EstoqueItem } | { type: 'movimento'; item: EstoqueItem } | null

export default function EstoqueClient({ itens }: { itens: EstoqueItem[] }) {
  const [filtroCategoria, setFiltroCategoria] = useState<string[]>([])
  const [filtroUnidade, setFiltroUnidade] = useState<string[]>([])
  const [modal, setModal] = useState<ModalState>(null)

  const { order, isVisible, toggleVisible, reorder } = useColumnPrefs('colunas:estoque', DEFAULT_ORDER)

  const itensFiltrados = useMemo(
    () =>
      itens
        .filter((item) => !filtroCategoria.length || filtroCategoria.includes(item.categoria))
        .filter((item) => !filtroUnidade.length || filtroUnidade.includes(item.unidade_medida)),
    [itens, filtroCategoria, filtroUnidade]
  )

  const columns: ColumnManagerColumn[] = [
    { key: 'nome', label: COLUMN_LABELS.nome },
    {
      key: 'categoria',
      label: COLUMN_LABELS.categoria,
      filter: { options: CATEGORIAS_ESTOQUE.map((c) => ({ value: c, label: c })), selected: filtroCategoria, onChange: setFiltroCategoria },
    },
    {
      key: 'unidade_medida',
      label: COLUMN_LABELS.unidade_medida,
      filter: { options: UNIDADES_MEDIDA.map((u) => ({ value: u, label: u })), selected: filtroUnidade, onChange: setFiltroUnidade },
    },
    { key: 'quantidade_atual', label: COLUMN_LABELS.quantidade_atual },
    { key: 'quantidade_minima', label: COLUMN_LABELS.quantidade_minima },
  ]

  const visibleOrder = order.filter(isVisible)
  const gridTemplate = [...visibleOrder.map((k) => COLUMN_WIDTHS[k]), ACAO_WIDTH].join(' ')
  const minWidth = computeRowMinWidth([...visibleOrder.map((k) => COLUMN_WIDTHS[k]), ACAO_WIDTH])

  function fecharModal() {
    setModal(null)
  }

  function renderCell(key: string, item: EstoqueItem) {
    const isLow = item.quantidade_atual < item.quantidade_minima
    switch (key) {
      case 'nome':
        return (
          <div className="text-strong">
            <Link href={`/estoque/${item.id}`}>{item.nome}</Link>
            {isLow && <span className="low-stock-flag">ESTOQUE BAIXO</span>}
          </div>
        )
      case 'categoria':
        return <div className="col-center text-muted">{item.categoria}</div>
      case 'unidade_medida':
        return <div className="col-center text-muted">{item.unidade_medida}</div>
      case 'quantidade_atual':
        return (
          <div className={`col-center${isLow ? ' valor-falta-positiva' : ''}`} style={{ fontWeight: 600 }}>
            {item.quantidade_atual}
          </div>
        )
      case 'quantidade_minima':
        return <div className="col-center text-muted">{item.quantidade_minima}</div>
      default:
        return <div />
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Estoque</h1>
        <button type="button" className="btn-primary" onClick={() => setModal({ type: 'item' })}>
          + Novo item
        </button>
      </div>

      <div className="toolbar" style={{ justifyContent: 'flex-end' }}>
        <ColumnManagerPanel columns={columns} order={order} isVisible={isVisible} onToggleVisible={toggleVisible} onReorder={reorder} />
      </div>

      <div className="data-table table-scroll">
        <div className="table-row table-head" style={{ gridTemplateColumns: gridTemplate, minWidth }}>
          {visibleOrder.map((key) => (
            <div key={key} className={key === 'nome' ? undefined : 'col-center'}>
              {COLUMN_LABELS[key]}
            </div>
          ))}
          <div></div>
        </div>
        {itensFiltrados.map((item) => {
          const isLow = item.quantidade_atual < item.quantidade_minima
          return (
            <div key={item.id} className={`table-row${isLow ? ' row-alert' : ''}`} style={{ gridTemplateColumns: gridTemplate, minWidth }}>
              {visibleOrder.map((key) => cloneElement(renderCell(key, item), { key }))}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <button type="button" className="action-link primary" onClick={() => setModal({ type: 'movimento', item })}>
                  movimentar
                </button>
                <button type="button" className="action-link" onClick={() => setModal({ type: 'item', item })}>
                  editar
                </button>
              </div>
            </div>
          )
        })}
        {itensFiltrados.length === 0 && <div className="empty-state">Nenhum item encontrado.</div>}
      </div>

      {modal?.type === 'item' && (
        <Modal title={modal.item ? 'Editar item de estoque' : 'Novo item de estoque'} onClose={fecharModal}>
          <ItemForm key={modal.item?.id ?? 'novo'} item={modal.item} onClose={fecharModal} />
        </Modal>
      )}

      {modal?.type === 'movimento' && (
        <Modal title="Registrar movimento" onClose={fecharModal}>
          <MovimentoForm key={modal.item.id} item={modal.item} onClose={fecharModal} />
        </Modal>
      )}
    </div>
  )
}
