'use client'

import { useMemo, useState } from 'react'
import { endOfMonth, format, startOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import DateRangePicker from '@/components/DateRangePicker'
import type { Despesa, Pedido } from '@/lib/types/domain'
import { formatCurrency, formatDateBR } from '@/lib/utils/format'

type Atividade = {
  id: string
  data: string
  descricao: string
  categoria: string
  valor: number
  positivo: boolean
}

export default function DashboardClient({ pedidos, despesas }: { pedidos: Pedido[]; despesas: Despesa[] }) {
  // Começa no mês atual (como o seletor de mês antigo), mas o usuário pode
  // escolher qualquer intervalo no calendário — ou limpar para ver tudo.
  const [periodoInicio, setPeriodoInicio] = useState(() => format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [periodoFim, setPeriodoFim] = useState(() => format(endOfMonth(new Date()), 'yyyy-MM-dd'))

  const pedidosDoMes = useMemo(
    () =>
      pedidos.filter(
        (p) => (!periodoInicio || p.data_venda >= periodoInicio) && (!periodoFim || p.data_venda <= periodoFim)
      ),
    [pedidos, periodoInicio, periodoFim]
  )
  const despesasDoMes = useMemo(
    () =>
      despesas.filter((d) => (!periodoInicio || d.data >= periodoInicio) && (!periodoFim || d.data <= periodoFim)),
    [despesas, periodoInicio, periodoFim]
  )

  const totalEntradas = useMemo(() => pedidosDoMes.reduce((soma, p) => soma + p.valor_pago, 0), [pedidosDoMes])
  const totalSaidas = useMemo(() => despesasDoMes.reduce((soma, d) => soma + d.valor, 0), [despesasDoMes])
  const saldo = totalEntradas - totalSaidas

  // Ticket médio = valor total do pedido (não o recebido) dividido pela
  // quantidade de vendas — sempre do mês/ano corrente do calendário,
  // independente do período escolhido no filtro acima.
  const hoje = new Date()
  const mesAtualStr = format(hoje, 'yyyy-MM')
  const anoAtualStr = format(hoje, 'yyyy')

  const pedidosMesAtual = useMemo(
    () => pedidos.filter((p) => p.data_venda.slice(0, 7) === mesAtualStr),
    [pedidos, mesAtualStr]
  )
  const pedidosAnoAtual = useMemo(
    () => pedidos.filter((p) => p.data_venda.slice(0, 4) === anoAtualStr),
    [pedidos, anoAtualStr]
  )

  const ticketMedioMensal = pedidosMesAtual.length
    ? pedidosMesAtual.reduce((soma, p) => soma + p.valor_total, 0) / pedidosMesAtual.length
    : 0
  const ticketMedioAnual = pedidosAnoAtual.length
    ? pedidosAnoAtual.reduce((soma, p) => soma + p.valor_total, 0) / pedidosAnoAtual.length
    : 0

  const atividadeDoMes = useMemo<Atividade[]>(() => {
    const daVenda: Atividade[] = pedidosDoMes
      .filter((p) => p.valor_pago > 0)
      .map((p) => ({
        id: `pedido-${p.id}`,
        data: p.data_venda,
        descricao: p.cliente,
        categoria: 'Venda',
        valor: p.valor_pago,
        positivo: true,
      }))
    const dasDespesas: Atividade[] = despesasDoMes.map((d) => ({
      id: `despesa-${d.id}`,
      data: d.data,
      descricao: d.descricao,
      categoria: d.categoria,
      valor: d.valor,
      positivo: false,
    }))
    return [...daVenda, ...dasDespesas].sort((a, b) => (a.data < b.data ? 1 : -1))
  }, [pedidosDoMes, despesasDoMes])

  return (
    <div>
      <div className="page-header">
        <h1>Resumo financeiro</h1>
        <DateRangePicker
          from={periodoInicio}
          to={periodoFim}
          onChange={(de, ate) => {
            setPeriodoInicio(de)
            setPeriodoFim(ate)
          }}
        />
      </div>

      <div className="summary-cards">
        <div className="summary-card entrada">
          <span>Entradas (recebido)</span>
          <strong>{formatCurrency(totalEntradas)}</strong>
        </div>
        <div className="summary-card saida">
          <span>Saídas</span>
          <strong>{formatCurrency(totalSaidas)}</strong>
        </div>
        <div className="summary-card saldo">
          <span>Saldo do período</span>
          <strong>{formatCurrency(saldo)}</strong>
        </div>
        <div className="summary-card">
          <span>Ticket médio mensal ({format(hoje, "MMMM'/'yyyy", { locale: ptBR })})</span>
          <strong>{formatCurrency(ticketMedioMensal)}</strong>
        </div>
        <div className="summary-card">
          <span>Ticket médio anual ({anoAtualStr})</span>
          <strong>{formatCurrency(ticketMedioAnual)}</strong>
        </div>
      </div>

      <h2>Atividade do período</h2>
      <div className="data-table">
        {atividadeDoMes.map((a) => (
          <div
            key={a.id}
            className="table-row"
            style={{ gridTemplateColumns: '90px 1fr 160px 110px' }}
          >
            <div className="text-muted">{formatDateBR(a.data)}</div>
            <div className="text-strong">{a.descricao}</div>
            <div className="text-muted">{a.categoria}</div>
            <div
              style={{
                textAlign: 'right',
                fontWeight: 600,
                color: a.positivo ? 'var(--primary)' : 'var(--danger)',
              }}
            >
              {a.positivo ? '+' : '-'} {formatCurrency(a.valor)}
            </div>
          </div>
        ))}
        {atividadeDoMes.length === 0 && <div className="empty-state">Nenhuma movimentação neste período.</div>}
      </div>
    </div>
  )
}
