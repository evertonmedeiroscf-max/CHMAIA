'use client'

import { useMemo, useState } from 'react'
import type { Despesa, Pedido } from '@/lib/types/domain'
import { formatCurrency } from '@/lib/utils/format'
import { gerarInsights, MESES, MESES_CURTOS, montarFaturamento, soma, ultimoMesComDado, variacao } from './analise'
import { GraficoBarras, GraficoLinhas, moedaCompacta } from './Graficos'

const GRID_CAIXA = '1fr 130px 130px 130px 80px 130px'

// Cor fixa por ano (segue o ano, não a posição): 1º ano do histórico usa a
// série 1, o seguinte a série 2 etc. — trocar o ano selecionado não repinta.
const CORES_SERIE = ['var(--serie-1)', 'var(--serie-2)', 'var(--serie-3)', 'var(--serie-4)']

const pct = (v: number) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(0)}%`

type LinhaMes = {
  mes: number
  entradas: number
  saidas: number
  vendas: number
  valorVendido: number
}

export default function ResumoAnualClient({ pedidos, despesas }: { pedidos: Pedido[]; despesas: Despesa[] }) {
  const hoje = new Date()
  const anoAtual = hoje.getFullYear()
  const [ano, setAno] = useState(anoAtual)

  const faturamento = useMemo(() => montarFaturamento(pedidos), [pedidos])
  const anosFaturamento = useMemo(() => [...faturamento.keys()].sort((a, b) => a - b), [faturamento])

  // Anos com alguma movimentação, sempre incluindo o ano corrente.
  const anos = useMemo(() => {
    const set = new Set<number>([anoAtual, ...anosFaturamento])
    despesas.forEach((d) => set.add(Number(d.data.slice(0, 4))))
    return [...set].filter((a) => !Number.isNaN(a)).sort((a, b) => b - a)
  }, [despesas, anoAtual, anosFaturamento])

  const corDoAno = (a: number) => CORES_SERIE[Math.max(0, anosFaturamento.indexOf(a)) % CORES_SERIE.length]

  // ---------- Desempenho (faturamento = valor vendido) ----------
  const vazio = MESES.map(() => null)
  const serie = faturamento.get(ano) ?? vazio
  const serieAnterior = faturamento.get(ano - 1)
  const ultimo = ultimoMesComDado(serie)
  const mesesComDado = serie.filter(Boolean).length
  const acumulado = soma(serie, ultimo + 1)
  const acumuladoAnterior = serieAnterior ? soma(serieAnterior, ultimo + 1) : 0
  const varAcumulado = serieAnterior ? variacao(acumulado, acumuladoAnterior) : null
  const periodo = ultimo >= 0 ? `jan–${MESES_CURTOS[ultimo].toLowerCase()}` : ''
  const mediaMensal = mesesComDado ? acumulado / mesesComDado : 0

  const comPedidos = serie.filter((p) => p?.pedidos)
  const totalPedidos = comPedidos.reduce((s, p) => s + p!.pedidos!, 0)
  const ticketAno = totalPedidos ? comPedidos.reduce((s, p) => s + p!.valor, 0) / totalPedidos : 0

  // Projeção para anos em andamento: o que falta segue o ano anterior mês a
  // mês — "conservadora" repete o ano anterior, "no ritmo atual" aplica o
  // crescimento acumulado sobre ele.
  const faltam = serieAnterior && ultimo >= 0 && ultimo < 11 ? soma(serieAnterior.slice(ultimo + 1)) : 0
  const projecaoConservadora = acumulado + faltam
  const projecaoRitmo = acumulado + faltam * (1 + (varAcumulado ?? 0))
  const temProjecao = faltam > 0

  const insights = useMemo(() => gerarInsights(ano, serie, serieAnterior), [ano, serie, serieAnterior])

  const seriesLinhas = anosFaturamento
    .filter((a) => a <= ano)
    .slice(-4)
    .map((a) => ({
      nome: String(a),
      cor: corDoAno(a),
      valores: (faturamento.get(a) ?? vazio).map((p) => p?.valor ?? null),
      destaque: a === ano,
    }))

  const variacoesMes = serie.map((p, i) => {
    const ant = serieAnterior?.[i]
    return p && ant ? variacao(p.valor, ant.valor) : null
  })
  const pedidosMes = serie.map((p) => p?.pedidos ?? null)
  const ticketMes = serie.map((p) => (p?.pedidos ? p.valor / p.pedidos : null))
  const temPedidos = pedidosMes.some((v) => v != null)
  const temSistema = serie.some((p) => p?.fonte === 'sistema')

  // ---------- Fluxo de caixa (dados do sistema) ----------
  // Mesmas regras do resumo mensal: entradas = valor_pago dos pedidos pela
  // data da venda; saídas = despesas pela data; ticket médio = valor_total.
  const linhas = useMemo<LinhaMes[]>(() => {
    const porMes: LinhaMes[] = MESES.map((_, i) => ({ mes: i, entradas: 0, saidas: 0, vendas: 0, valorVendido: 0 }))
    const prefixo = String(ano)
    pedidos.forEach((p) => {
      if (p.data_venda.slice(0, 4) !== prefixo) return
      const linha = porMes[Number(p.data_venda.slice(5, 7)) - 1]
      linha.entradas += p.valor_pago
      linha.vendas += 1
      linha.valorVendido += p.valor_total
    })
    despesas.forEach((d) => {
      if (d.data.slice(0, 4) !== prefixo) return
      porMes[Number(d.data.slice(5, 7)) - 1].saidas += d.valor
    })
    return porMes
  }, [pedidos, despesas, ano])

  const total = linhas.reduce(
    (acc, l) => ({
      entradas: acc.entradas + l.entradas,
      saidas: acc.saidas + l.saidas,
      vendas: acc.vendas + l.vendas,
      valorVendido: acc.valorVendido + l.valorVendido,
    }),
    { entradas: 0, saidas: 0, vendas: 0, valorVendido: 0 }
  )
  const saldo = total.entradas - total.saidas
  const ticketMedio = total.vendas ? total.valorVendido / total.vendas : 0

  const corSaldo = (valor: number) => (valor < 0 ? 'var(--danger)' : 'var(--primary)')

  return (
    <div>
      <div className="page-header">
        <h1>Resumo financeiro anual</h1>
        <select className="select-control" value={ano} onChange={(e) => setAno(Number(e.target.value))}>
          {anos.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      <h2>Desempenho de vendas</h2>
      {ultimo < 0 ? (
        <div className="data-table">
          <div className="empty-state">Nenhum faturamento registrado em {ano}.</div>
        </div>
      ) : (
        <>
          <div className="summary-cards">
            <div className="summary-card entrada">
              <span>Faturamento {mesesComDado < 12 ? `acumulado (${periodo})` : 'no ano'}</span>
              <strong>{formatCurrency(acumulado)}</strong>
              {varAcumulado != null && (
                <em className={`kpi-delta ${varAcumulado >= 0 ? 'up' : 'down'}`}>
                  {varAcumulado >= 0 ? '▲' : '▼'} {pct(varAcumulado)} vs {ano - 1} no mesmo período
                </em>
              )}
            </div>
            <div className="summary-card">
              <span>Média mensal</span>
              <strong>{formatCurrency(mediaMensal)}</strong>
              <em className="kpi-delta">
                {mesesComDado} {mesesComDado === 1 ? 'mês' : 'meses'} com lançamento
              </em>
            </div>
            {totalPedidos > 0 && (
              <div className="summary-card">
                <span>Pedidos · ticket médio</span>
                <strong>{totalPedidos}</strong>
                <em className="kpi-delta">ticket médio de {formatCurrency(ticketAno)}</em>
              </div>
            )}
            {temProjecao && (
              <div className="summary-card saldo">
                <span>Projeção de fechamento {ano}</span>
                <strong>{formatCurrency(projecaoRitmo)}</strong>
                <em className="kpi-delta">
                  no ritmo atual · conservadora {formatCurrency(projecaoConservadora)}
                </em>
              </div>
            )}
          </div>

          <div className="chart-card">
            <div className="chart-card-header">
              <div>
                <div className="chart-title">Faturamento mensal por ano</div>
                <div className="chart-subtitle">Valor vendido no mês · passe o mouse para comparar os anos</div>
              </div>
              <div className="chart-legend">
                {seriesLinhas.map((s) => (
                  <span key={s.nome} className={s.destaque ? 'destaque' : undefined}>
                    <i style={{ background: s.cor }} />
                    {s.nome}
                  </span>
                ))}
              </div>
            </div>
            <GraficoLinhas series={seriesLinhas} formatar={formatCurrency} />
          </div>

          <div className="dash-grid">
            {serieAnterior && (
              <div className="chart-card">
                <div className="chart-title">
                  Variação mensal {ano} vs {ano - 1}
                </div>
                <div className="chart-subtitle">Verde = cresceu · vermelho = caiu em relação ao mesmo mês</div>
                <GraficoBarras
                  valores={variacoesMes}
                  cor={(v) => (v >= 0 ? 'var(--primary)' : 'var(--danger)')}
                  formatar={pct}
                  formatarEixo={(v) => `${(v * 100).toFixed(0)}%`}
                  rotulo={`Var. vs ${ano - 1}`}
                  detalhe={(i) => (
                    <>
                      <div className="chart-tooltip-row">
                        <span>{ano}</span>
                        <strong>{formatCurrency(serie[i]!.valor)}</strong>
                      </div>
                      <div className="chart-tooltip-row">
                        <span>{ano - 1}</span>
                        <strong>{formatCurrency(serieAnterior[i]!.valor)}</strong>
                      </div>
                    </>
                  )}
                />
              </div>
            )}

            <div className="chart-card">
              <div className="chart-title">Pontos para decisão</div>
              <div className="chart-subtitle">Leituras automáticas a partir dos números acima</div>
              <ul className="insights">
                {insights.map((ins) => (
                  <li key={ins.titulo} className={`insight ${ins.tipo}`}>
                    <span className="insight-icon" aria-hidden>
                      {ins.tipo === 'positivo' ? '▲' : ins.tipo === 'atencao' ? '!' : 'i'}
                    </span>
                    <div>
                      <strong>{ins.titulo}</strong>
                      <p>{ins.texto}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {temPedidos && (
            <div className="dash-grid">
              <div className="chart-card">
                <div className="chart-title">Pedidos por mês</div>
                <div className="chart-subtitle">Volume de vendas</div>
                <GraficoBarras
                  valores={pedidosMes}
                  cor={() => 'var(--serie-1)'}
                  formatar={(v) => String(v)}
                  rotulo="Pedidos"
                  altura={200}
                />
              </div>
              <div className="chart-card">
                <div className="chart-title">Ticket médio por mês</div>
                <div className="chart-subtitle">Faturamento ÷ pedidos</div>
                <GraficoBarras
                  valores={ticketMes}
                  cor={() => 'var(--serie-2)'}
                  formatar={(v) =>
                    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
                  }
                  formatarEixo={moedaCompacta}
                  rotulo="Ticket médio"
                  altura={200}
                />
              </div>
            </div>
          )}

          <div className="data-table table-scroll">
            {(() => {
              const colunas = seriesLinhas.map((s) => Number(s.nome))
              const grid = `1fr ${colunas.map(() => '120px').join(' ')}${serieAnterior ? ' 110px' : ''}`
              const minWidth = 140 + colunas.length * 132 + (serieAnterior ? 122 : 0)
              return (
                <>
                  <div className="table-row table-head" style={{ gridTemplateColumns: grid, minWidth }}>
                    <div>MÊS</div>
                    {colunas.map((a) => (
                      <div key={a} className="col-right">
                        {a}
                      </div>
                    ))}
                    {serieAnterior && (
                      <div className="col-right">
                        VAR. {String(ano).slice(2)} VS {String(ano - 1).slice(2)}
                      </div>
                    )}
                  </div>
                  {MESES.map((m, i) => (
                    <div key={m} className="table-row" style={{ gridTemplateColumns: grid, minWidth }}>
                      <div className="text-strong">{m}</div>
                      {colunas.map((a) => {
                        const p = faturamento.get(a)?.[i]
                        return (
                          <div key={a} className="col-right" title={p?.fonte === 'sistema' ? 'Pedidos do sistema' : undefined}>
                            {p ? formatCurrency(p.valor) : <span className="text-muted">—</span>}
                            {p?.fonte === 'sistema' && <sup className="text-muted">*</sup>}
                          </div>
                        )
                      })}
                      {serieAnterior && (
                        <div
                          className="col-right"
                          style={{
                            fontWeight: 600,
                            color: variacoesMes[i] == null ? undefined : corSaldo(variacoesMes[i]!),
                          }}
                        >
                          {variacoesMes[i] == null ? <span className="text-muted">—</span> : pct(variacoesMes[i]!)}
                        </div>
                      )}
                    </div>
                  ))}
                  <div className="table-row table-total" style={{ gridTemplateColumns: grid, minWidth }}>
                    <div>Total</div>
                    {colunas.map((a) => (
                      <div key={a} className="col-right">
                        {formatCurrency(soma(faturamento.get(a) ?? vazio))}
                      </div>
                    ))}
                    {serieAnterior && <div />}
                  </div>
                </>
              )
            })()}
          </div>
          <p className="chart-footnote">
            Fonte: planilha de faturamento 2024–2026 (caderno de anotações)
            {temSistema ? '; * meses sem lançamento na planilha vêm dos pedidos cadastrados no sistema' : ''}.
          </p>
        </>
      )}

      <h2>Fluxo de caixa do sistema</h2>
      <div className="summary-cards">
        <div className="summary-card entrada">
          <span>Entradas no ano (recebido)</span>
          <strong>{formatCurrency(total.entradas)}</strong>
        </div>
        <div className="summary-card saida">
          <span>Saídas no ano</span>
          <strong>{formatCurrency(total.saidas)}</strong>
        </div>
        <div className="summary-card saldo">
          <span>Saldo do ano</span>
          <strong>{formatCurrency(saldo)}</strong>
        </div>
        <div className="summary-card">
          <span>Vendas no ano</span>
          <strong>{total.vendas}</strong>
        </div>
        <div className="summary-card">
          <span>Ticket médio anual ({ano})</span>
          <strong>{formatCurrency(ticketMedio)}</strong>
        </div>
      </div>

      <div className="data-table table-scroll">
        <div className="table-row table-head" style={{ gridTemplateColumns: GRID_CAIXA, minWidth: 720 }}>
          <div>MÊS</div>
          <div className="col-right">ENTRADAS</div>
          <div className="col-right">SAÍDAS</div>
          <div className="col-right">SALDO</div>
          <div className="col-center">VENDAS</div>
          <div className="col-right">TICKET MÉDIO</div>
        </div>
        {linhas.map((l) => {
          const saldoMes = l.entradas - l.saidas
          return (
            <div key={l.mes} className="table-row" style={{ gridTemplateColumns: GRID_CAIXA, minWidth: 720 }}>
              <div className="text-strong">{MESES[l.mes]}</div>
              <div className="col-right">{formatCurrency(l.entradas)}</div>
              <div className="col-right">{formatCurrency(l.saidas)}</div>
              <div className="col-right" style={{ fontWeight: 600, color: corSaldo(saldoMes) }}>
                {formatCurrency(saldoMes)}
              </div>
              <div className="col-center">{l.vendas}</div>
              <div className="col-right">{formatCurrency(l.vendas ? l.valorVendido / l.vendas : 0)}</div>
            </div>
          )
        })}
        <div className="table-row table-total" style={{ gridTemplateColumns: GRID_CAIXA, minWidth: 720 }}>
          <div>Total {ano}</div>
          <div className="col-right">{formatCurrency(total.entradas)}</div>
          <div className="col-right">{formatCurrency(total.saidas)}</div>
          <div className="col-right" style={{ color: corSaldo(saldo) }}>
            {formatCurrency(saldo)}
          </div>
          <div className="col-center">{total.vendas}</div>
          <div className="col-right">{formatCurrency(ticketMedio)}</div>
        </div>
      </div>
    </div>
  )
}
