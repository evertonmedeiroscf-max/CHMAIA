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
import Modal from '@/components/Modal'
import type { Pedido } from '@/lib/types/domain'
import { formatCurrency, formatDateBR } from '@/lib/utils/format'

const DIAS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

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

export default function PedidosCalendar({
  pedidos,
  onEdit,
}: {
  pedidos: Pedido[]
  onEdit: (pedido: Pedido) => void
}) {
  const [mesAtual, setMesAtual] = useState(() => startOfMonth(new Date()))
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null)

  // O calendário sempre posiciona o pedido pela data do evento — é quando o
  // buffet efetivamente acontece. Só cai pra data da venda quando não há
  // data do evento cadastrada (pedido ainda sem previsão de evento).
  const pedidosPorDia = useMemo(() => {
    const mapa = new Map<string, Pedido[]>()
    for (const pedido of pedidos) {
      const chave = pedido.data_evento || pedido.data_venda
      const lista = mapa.get(chave) ?? []
      lista.push(pedido)
      mapa.set(chave, lista)
    }
    // Dentro do dia, ordena pela hora do evento (quem não tem hora fica por
    // último) — assim a lista/etiquetas seguem a ordem real dos eventos.
    for (const lista of mapa.values()) {
      lista.sort((a, b) => {
        if (!a.hora_evento && !b.hora_evento) return 0
        if (!a.hora_evento) return 1
        if (!b.hora_evento) return -1
        return a.hora_evento.localeCompare(b.hora_evento)
      })
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
  const pedidosDoDiaSelecionado = diaSelecionado ? pedidosPorDia.get(diaSelecionado) ?? [] : []

  function abrirPedido(pedido: Pedido) {
    setDiaSelecionado(null)
    onEdit(pedido)
  }

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
            // Clicar em qualquer parte do dia (número, espaço vazio, "+N")
            // abre a lista completa de pedidos daquele dia. Clicar direto
            // numa etiqueta de pedido continua abrindo o pedido na hora
            // (stopPropagation evita que isso também dispare a lista do dia).
            <div
              key={chave}
              role="button"
              tabIndex={0}
              onClick={() => setDiaSelecionado(chave)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') setDiaSelecionado(chave)
              }}
              className={`calendar-cell${isSameMonth(dia, mesAtual) ? '' : ' outside'}${isToday ? ' today' : ''}`}
              style={{ cursor: 'pointer' }}
            >
              <span className="calendar-day-number">{format(dia, 'd')}</span>
              {visiveis.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    abrirPedido(p)
                  }}
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

      {diaSelecionado && (
        <Modal title={`Pedidos de ${formatDateBR(diaSelecionado)}`} onClose={() => setDiaSelecionado(null)}>
          {pedidosDoDiaSelecionado.length === 0 ? (
            <p className="empty-state">Nenhum pedido nesse dia.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pedidosDoDiaSelecionado.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => abrirPedido(p)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    textAlign: 'left',
                    width: '100%',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: 12,
                    background: 'var(--surface)',
                    cursor: 'pointer',
                  }}
                >
                  <div>
                    <div className="text-strong">{p.cliente}</div>
                    <div className="text-muted" style={{ fontSize: 12, marginTop: 2 }}>
                      {p.hora_evento ? `Evento às ${p.hora_evento.slice(0, 5)} — ` : ''}
                      {formatCurrency(p.valor_total)}
                    </div>
                  </div>
                  <span className={`badge ${STATUS_BADGE_CLASS[p.status]}`}>{STATUS_LABEL[p.status]}</span>
                </button>
              ))}
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}
