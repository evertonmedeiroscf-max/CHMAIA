'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { addMonths, eachDayOfInterval, endOfMonth, format, getDay, startOfMonth, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { formatDateBR } from '@/lib/utils/format'

const DIAS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

function toDate(iso: string) {
  const [ano, mes, dia] = iso.split('-').map(Number)
  return new Date(ano, mes - 1, dia)
}

const toISO = (d: Date) => format(d, 'yyyy-MM-dd')

// Datas em "YYYY-MM-DD" (comparáveis como texto). Clique 1 define o início,
// clique 2 o fim; um novo clique com o intervalo já completo (ou anterior ao
// início) recomeça a seleção.
export function DateRangeCalendar({
  from,
  to,
  onChange,
}: {
  from: string
  to: string
  onChange: (from: string, to: string) => void
}) {
  const [mes, setMes] = useState(() => startOfMonth(from ? toDate(from) : new Date()))

  const dias = useMemo(() => eachDayOfInterval({ start: startOfMonth(mes), end: endOfMonth(mes) }), [mes])
  const hoje = toISO(new Date())

  function clicar(dia: Date) {
    const k = toISO(dia)
    if (!from || to || k < from) onChange(k, '')
    else onChange(from, k)
  }

  return (
    <div className="range-calendar">
      <div className="range-cal-header">
        <button type="button" className="range-cal-nav" onClick={() => setMes((m) => subMonths(m, 1))}>
          ←
        </button>
        <span className="range-cal-title">{format(mes, 'LLLL, yyyy', { locale: ptBR })}</span>
        <button type="button" className="range-cal-nav" onClick={() => setMes((m) => addMonths(m, 1))}>
          →
        </button>
      </div>

      <div className="range-cal-grid">
        {DIAS_SEMANA.map((d, i) => (
          <div key={i} className="range-cal-weekday">
            {d}
          </div>
        ))}
        {Array.from({ length: getDay(startOfMonth(mes)) }).map((_, i) => (
          <div key={`vazio-${i}`} />
        ))}
        {dias.map((dia) => {
          const k = toISO(dia)
          const borda = k === from || k === to
          const dentro = !!from && !!to && k > from && k < to
          return (
            <button
              key={k}
              type="button"
              onClick={() => clicar(dia)}
              className={`range-cal-day${borda ? ' edge' : ''}${dentro ? ' in-range' : ''}${k === hoje ? ' today' : ''}`}
            >
              {format(dia, 'd')}
            </button>
          )
        })}
      </div>

      <div className="range-cal-summary">
        <span>
          {from ? `${formatDateBR(from)} – ${to ? formatDateBR(to) : 'escolha o fim'}` : 'Escolha o início'}
        </span>
        {(from || to) && (
          <button type="button" className="action-link" onClick={() => onChange('', '')}>
            limpar
          </button>
        )}
      </div>
    </div>
  )
}

// Versão em botão + popover, para telas sem o painel "Colunas" (ex.: Resumo
// financeiro).
export default function DateRangePicker({
  from,
  to,
  onChange,
}: {
  from: string
  to: string
  onChange: (from: string, to: string) => void
}) {
  const [aberto, setAberto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function fora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [])

  const rotulo = from ? `${formatDateBR(from)} – ${to ? formatDateBR(to) : '...'}` : 'Todo o período'

  return (
    <div className="range-picker" ref={ref}>
      <button type="button" className="select-control" onClick={() => setAberto((v) => !v)}>
        {rotulo}
      </button>
      {aberto && (
        <div className="range-picker-pop">
          <DateRangeCalendar from={from} to={to} onChange={onChange} />
        </div>
      )}
    </div>
  )
}
