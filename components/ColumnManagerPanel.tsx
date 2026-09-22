'use client'

import { useEffect, useRef, useState } from 'react'
import { DateRangeCalendar } from '@/components/DateRangePicker'

export type ColumnManagerColumn = {
  key: string
  label: string
  filter?: {
    options: { value: string; label: string }[]
    selected: string[]
    onChange: (values: string[]) => void
  }
  dateRangeFilter?: {
    from: string
    to: string
    onChangeFrom: (value: string) => void
    onChangeTo: (value: string) => void
  }
}

export default function ColumnManagerPanel({
  columns,
  order,
  isVisible,
  onToggleVisible,
  onReorder,
}: {
  columns: ColumnManagerColumn[]
  order: string[]
  isVisible: (key: string) => boolean
  onToggleVisible: (key: string) => void
  onReorder: (order: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [draggingKey, setDraggingKey] = useState<string | null>(null)
  const dragKeyRef = useRef<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const byKey = new Map(columns.map((c) => [c.key, c]))

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function handleDragStart(key: string) {
    dragKeyRef.current = key
    setDraggingKey(key)
  }

  function handleDragEnd() {
    dragKeyRef.current = null
    setDraggingKey(null)
  }

  function handleDrop(targetKey: string) {
    const dragKey = dragKeyRef.current
    if (!dragKey || dragKey === targetKey) return
    const next = order.filter((k) => k !== dragKey)
    const targetIdx = next.indexOf(targetKey)
    next.splice(targetIdx, 0, dragKey)
    onReorder(next)
    dragKeyRef.current = null
    setDraggingKey(null)
  }

  function toggleFilterValue(col: ColumnManagerColumn, value: string) {
    if (!col.filter) return
    const { selected, onChange } = col.filter
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value])
  }

  return (
    <div className="column-manager" ref={ref}>
      <button type="button" className="btn-secondary" onClick={() => setOpen((v) => !v)}>
        Colunas
      </button>
      {open && (
        <div className="column-manager-panel">
          {order.map((key) => {
            const col = byKey.get(key)
            if (!col) return null
            const visible = isVisible(key)
            return (
              <div
                key={key}
                className={`column-manager-row${draggingKey === key ? ' dragging' : ''}`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(key)}
              >
                <div className="column-manager-row-main">
                  <span
                    className="column-manager-handle"
                    title="Arrastar para reordenar"
                    draggable
                    onDragStart={() => handleDragStart(key)}
                    onDragEnd={handleDragEnd}
                  >
                    ⠿
                  </span>
                  <label className="column-manager-checkbox">
                    <input type="checkbox" checked={visible} onChange={() => onToggleVisible(key)} />
                    {col.label}
                  </label>
                </div>
                {col.filter && (
                  <details className="column-manager-filter">
                    <summary>
                      Filtrar{col.filter.selected.length > 0 ? ` (${col.filter.selected.length})` : ''}
                    </summary>
                    <div className="column-manager-filter-options">
                      {col.filter.options.map((opt) => (
                        <label key={opt.value} className="col-filter-option">
                          <input
                            type="checkbox"
                            checked={col.filter!.selected.includes(opt.value)}
                            onChange={() => toggleFilterValue(col, opt.value)}
                          />
                          {opt.label}
                        </label>
                      ))}
                      {col.filter.options.length === 0 && (
                        <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: 4 }}>Sem opções</p>
                      )}
                      {col.filter.selected.length > 0 && (
                        <button
                          type="button"
                          className="action-link"
                          style={{ marginTop: 4 }}
                          onClick={() => col.filter!.onChange([])}
                        >
                          limpar filtro
                        </button>
                      )}
                    </div>
                  </details>
                )}
                {col.dateRangeFilter && (
                  <details className="column-manager-filter">
                    <summary>
                      Período
                      {col.dateRangeFilter.from || col.dateRangeFilter.to ? ' (ativo)' : ''}
                    </summary>
                    <div className="column-manager-filter-options" style={{ maxHeight: 'none', overflow: 'visible' }}>
                      <DateRangeCalendar
                        from={col.dateRangeFilter.from}
                        to={col.dateRangeFilter.to}
                        onChange={(de, ate) => {
                          col.dateRangeFilter!.onChangeFrom(de)
                          col.dateRangeFilter!.onChangeTo(ate)
                        }}
                      />
                    </div>
                  </details>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
