'use client'

import { useMemo, useState } from 'react'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isSameDay,
  isSameMonth,
  startOfMonth,
  subMonths,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Pedido } from '@/lib/types/domain'

const DIAS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

export default function PedidosCalendar({
  pedidos,
  onEdit,
}: {
  pedidos: Pedido[]
  onEdit: (pedido: Pedido) => void
}) {
  const [mesAtual, setMesAtual] = useState(() => startOfMonth(new Date()))

  const pedidosPorDia = useMemo(() => {
    const mapa = new Map<string, Pedido[]>()
    for (const pedido of pedidos) {
      const lista = mapa.get(pedido.data_venda) ?? []
      lista.push(pedido)
      mapa.set(pedido.data_venda, lista)
    }
    return mapa
  }, [pedidos])

  const dias = useMemo(() => {
    const inicio = startOfMonth(mesAtual)
    const fim = endOfMonth(mesAtual)
    return eachDayOfInterval({ start: inicio, end: fim })
  }, [mesAtual])

  const offsetInicial = getDay(startOfMonth(mesAtual))
  const hoje = new Date()

  return (
    <div className="calendar">
      <div className="calendar-header">
        <button type="button" onClick={() => setMesAtual((m) => subMonths(m, 1))}>
          ‹
        </button>
        <h2>{format(mesAtual, "MMMM 'de' yyyy", { locale: ptBR })}</h2>
        <button type="button" onClick={() => setMesAtual((m) => addMonths(m, 1))}>
          ›
        </button>
      </div>
      <div className="calendar-grid">
        {DIAS_SEMANA.map((d, i) => (
          <div key={i} className="calendar-weekday">
            {d}
          </div>
        ))}
        {Array.from({ length: offsetInicial }).map((_, i) => (
          <div key={`blank-${i}`} className="calendar-cell outside" />
        ))}
        {dias.map((dia) => {
          const chave = format(dia, 'yyyy-MM-dd')
          const pedidosDoDia = pedidosPorDia.get(chave) ?? []
          const visiveis = pedidosDoDia.slice(0, 2)
          const restantes = pedidosDoDia.length - visiveis.length
          const isToday = isSameDay(dia, hoje)
          return (
            <div
              key={chave}
              className={`calendar-cell${isSameMonth(dia, mesAtual) ? '' : ' outside'}${isToday ? ' today' : ''}`}
            >
              <span className="calendar-day-number">{format(dia, 'd')}</span>
              {visiveis.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onEdit(p)}
                  className="calendar-event"
                  title={p.cliente}
                  style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer' }}
                >
                  {p.cliente}
                </button>
              ))}
              {restantes > 0 && <div className="calendar-more">+{restantes}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
