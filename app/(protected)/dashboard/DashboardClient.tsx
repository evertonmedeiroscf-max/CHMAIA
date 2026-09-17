'use client'

import { useMemo, useState } from 'react'
import type { Despesa, Pedido } from '@/lib/types/domain'
import { formatCurrency, formatDateBR, formatMonthLabel } from '@/lib/utils/format'

function mesAtualISO() {
  return new Date().toISOString().slice(0, 7)
}

type Atividade = {
  id: string
  data: string
  descricao: string
  categoria: string
  valor: number
  positivo: boolean
}

export default function DashboardClient({ pedidos, despesas }: { pedidos: Pedido[]; despesas: Despesa[] }) {
  const [filtroMes, setFiltroMes] = useState(mesAtualISO)

  const opcoesMes = useMemo(() => {
    const meses = new Set<string>([
      ...pedidos.map((p) => p.data_venda.slice(0, 7)),
      ...despesas.map((d) => d.data.slice(0, 7)),
      filtroMes,
    ])
    return Array.from(meses)
      .sort()
      .reverse()
      .map((m) => ({ value: m, label: formatMonthLabel(m) }))
  }, [pedidos, despesas, filtroMes])

  const pedidosDoMes = useMemo(
    () => pedidos.filter((p) => p.data_venda.slice(0, 7) === filtroMes),
    [pedidos, filtroMes]
  )
  const despesasDoMes = useMemo(
    () => despesas.filter((d) => d.data.slice(0, 7) === filtroMes),
    [despesas, filtroMes]
  )

  const totalEntradas = useMemo(() => pedidosDoMes.reduce((soma, p) => soma + p.valor_pago, 0), [pedidosDoMes])
  const totalSaidas = useMemo(() => despesasDoMes.reduce((soma, d) => soma + d.valor, 0), [despesasDoMes])
  const saldo = totalEntradas - totalSaidas

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
        <select className="select-control" value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)}>
          {opcoesMes.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
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
      </div>

      <h2>Atividade do mês</h2>
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
        {atividadeDoMes.length === 0 && <div className="empty-state">Nenhuma movimentação neste mês.</div>}
      </div>
    </div>
  )
}
