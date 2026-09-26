'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { DateRangeCalendar } from '@/components/DateRangePicker'

export type HeaderFilterConfig = {
  options: { value: string; label: string }[]
  selected: string[]
  onChange: (values: string[]) => void
}

export type HeaderDateRangeConfig = {
  from: string
  to: string
  onChangeFrom: (value: string) => void
  onChangeTo: (value: string) => void
}

// Setinha de filtro "estilo Excel" direto no cabeçalho da coluna — em vez
// de precisar abrir o painel "Colunas" pra filtrar, clica na setinha ao
// lado do nome da coluna e já abre o checklist (ou o calendário de
// período, pra colunas de data) ali mesmo. O menu é renderizado num portal
// (fora da tabela) e posicionado por coordenada, porque a tabela tem
// overflow controlado para o scroll horizontal — se o menu fosse filho
// dela, ficaria cortado em telas com poucas linhas.
//
// Convenção do projeto: toda aba de listagem (padrão data-table +
// ColumnManagerColumn, como Estoque/Pedidos/Despesas/Notas Fiscais/
// Orçamentos/Produtos) usa este componente em TODAS as colunas filtráveis
// do cabeçalho — inclusive abas novas que forem criadas depois. Só ficam de
// fora colunas de ação (ex.: "editar") e telas com estrutura de tabela
// diferente (ex.: Histórico, que é uma lista de cartões, sem cabeçalho de
// coluna).
export default function ColumnHeaderFilter({
  filter,
  dateRangeFilter,
}: {
  filter?: HeaderFilterConfig
  dateRangeFilter?: HeaderDateRangeConfig
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const [busca, setBusca] = useState('')
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      const alvo = e.target as Node
      if (btnRef.current?.contains(alvo)) return
      if (menuRef.current?.contains(alvo)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  useEffect(() => {
    if (!open) setBusca('')
  }, [open])

  useEffect(() => {
    if (!open) return
    function reposicionar() {
      const r = btnRef.current?.getBoundingClientRect()
      if (r) setPos({ top: r.bottom + 4, left: r.left })
    }
    reposicionar()
    window.addEventListener('scroll', reposicionar, true)
    window.addEventListener('resize', reposicionar)
    return () => {
      window.removeEventListener('scroll', reposicionar, true)
      window.removeEventListener('resize', reposicionar)
    }
  }, [open])

  if (!filter && !dateRangeFilter) return null

  const ativo = filter ? filter.selected.length > 0 : !!(dateRangeFilter?.from || dateRangeFilter?.to)

  function toggleValue(value: string) {
    if (!filter) return
    const { selected, onChange } = filter
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value])
  }

  function normalizar(texto: string) {
    return texto
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
  }

  const opcoesFiltradas = filter
    ? busca
      ? filter.options.filter((opt) => normalizar(opt.label).includes(normalizar(busca)))
      : filter.options
    : []

  return (
    <span className="col-filter">
      <button
        ref={btnRef}
        type="button"
        className={`col-filter-toggle${ativo ? ' active' : ''}`}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        aria-label="Filtrar coluna"
      >
        ▾
      </button>
      {open &&
        pos &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={menuRef}
            className="col-filter-menu"
            style={{ position: 'fixed', top: pos.top, left: pos.left }}
            onClick={(e) => e.stopPropagation()}
          >
            {filter && (
              <>
                {filter.options.length > 5 && (
                  <input
                    type="text"
                    className="col-filter-search"
                    placeholder="Pesquisar..."
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    autoFocus
                  />
                )}
                <div className="col-filter-list">
                  {opcoesFiltradas.map((opt) => (
                    <label key={opt.value} className="col-filter-option">
                      <input type="checkbox" checked={filter.selected.includes(opt.value)} onChange={() => toggleValue(opt.value)} />
                      {opt.label}
                    </label>
                  ))}
                  {filter.options.length === 0 && <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: 4 }}>Sem opções</p>}
                  {filter.options.length > 0 && opcoesFiltradas.length === 0 && (
                    <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: 4 }}>Nenhum resultado</p>
                  )}
                </div>
                <div className="col-filter-footer">
                  <span className="col-filter-clear" onClick={() => filter.onChange([])}>
                    limpar
                  </span>
                  <span className="col-filter-ok" onClick={() => setOpen(false)}>
                    ok
                  </span>
                </div>
              </>
            )}
            {dateRangeFilter && (
              <DateRangeCalendar
                from={dateRangeFilter.from}
                to={dateRangeFilter.to}
                onChange={(de, ate) => {
                  dateRangeFilter.onChangeFrom(de)
                  dateRangeFilter.onChangeTo(ate)
                }}
              />
            )}
          </div>,
          document.body
        )}
    </span>
  )
}
