'use client'

import { useMemo } from 'react'
import type { EstoqueItem } from '@/lib/types/domain'
import { formatCurrency } from '@/lib/utils/format'

// Cortes clássicos da curva ABC: A = itens que respondem por até 80% do
// valor acumulado, B = de 80% a 95%, C = os últimos 5%. O corte é aplicado
// pelo valor ACUMULADO ANTES de somar o item (não depois) — assim o item
// que empurra o acumulado de, digamos, 78% pra 85% continua na Curva A, em
// vez de "roubar" a classificação errada por causa do próprio salto.
const LIMITE_A = 80
const LIMITE_B = 95
const TOP_GRAFICO = 30
const LARGURA_BARRA = 34

type Classe = 'A' | 'B' | 'C'

function formatPct(v: number) {
  return `${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}

export default function CurvaABCModal({ itens, onClose }: { itens: EstoqueItem[]; onClose: () => void }) {
  const analise = useMemo(() => {
    // Itens sem custo/und. cadastrado têm valor_total_estoque = 0 — não é
    // que valem zero, é que falta dado. Excluir da curva (mas avisar
    // quantos ficaram de fora) em vez de fingir que valem zero mesmo.
    const analisaveis = itens.filter((i) => i.valor_total_estoque > 0)
    const semCusto = itens.length - analisaveis.length
    const ordenados = [...analisaveis].sort((a, b) => b.valor_total_estoque - a.valor_total_estoque)
    const total = ordenados.reduce((soma, i) => soma + i.valor_total_estoque, 0)

    let acumuladoAntes = 0
    const classificados = ordenados.map((item) => {
      const pctAntes = total > 0 ? (acumuladoAntes / total) * 100 : 0
      const classe: Classe = pctAntes < LIMITE_A ? 'A' : pctAntes < LIMITE_B ? 'B' : 'C'
      acumuladoAntes += item.valor_total_estoque
      const pctAcumulado = total > 0 ? (acumuladoAntes / total) * 100 : 0
      return { item, classe, pctAcumulado }
    })

    const porClasse: Record<Classe, { produtos: number; valor: number }> = {
      A: { produtos: 0, valor: 0 },
      B: { produtos: 0, valor: 0 },
      C: { produtos: 0, valor: 0 },
    }
    classificados.forEach(({ classe, item }) => {
      porClasse[classe].produtos += 1
      porClasse[classe].valor += item.valor_total_estoque
    })

    function agruparPor(getter: (item: EstoqueItem) => string | null) {
      const mapa = new Map<string, number>()
      ordenados.forEach((item) => {
        const chave = getter(item) ?? '(sem informação)'
        mapa.set(chave, (mapa.get(chave) ?? 0) + item.valor_total_estoque)
      })
      return Array.from(mapa.entries())
        .map(([nome, valor]) => ({ nome, valor }))
        .sort((a, b) => b.valor - a.valor)
    }

    return {
      analisaveis,
      semCusto,
      total,
      classificados,
      porClasse,
      porCategoria: agruparPor((i) => i.categoria),
      porMarca: agruparPor((i) => i.marca_fornecedor).slice(0, 8),
    }
  }, [itens])

  const { analisaveis, semCusto, total, classificados, porClasse, porCategoria, porMarca } = analise

  const pctClasse = (c: Classe) => (total > 0 ? (porClasse[c].valor / total) * 100 : 0)
  const gA = pctClasse('A')
  const gB = pctClasse('B')
  const gC = 100 - gA - gB

  const topGrafico = classificados.slice(0, TOP_GRAFICO)
  const maiorValor = topGrafico.length ? topGrafico[0].item.valor_total_estoque : 0

  const corClasse: Record<Classe, string> = { A: 'var(--abc-a)', B: 'var(--abc-b)', C: 'var(--abc-c)' }

  const altura = 260
  const margemBase = 78
  const margemEsquerda = 34
  const alturaBarras = altura - margemBase
  const largura = Math.max(topGrafico.length * LARGURA_BARRA + margemEsquerda + 16, 320)

  return (
    <div>
      <p className="modal-item-label" style={{ marginTop: -12, marginBottom: 18 }}>
        Classificação dos itens pelo valor parado em estoque (custo × quantidade atual): a Curva A concentra o maior
        valor em poucos itens — são os que mais merecem atenção de compra e contagem — e a Curva C reúne muitos itens
        de baixo impacto financeiro.
        {semCusto > 0 &&
          ` ${semCusto} ${semCusto === 1 ? 'item não entrou' : 'itens não entraram'} na análise por não ter custo/und. cadastrado.`}
      </p>

      <div className="abc-kpis">
        <div className="abc-kpi">
          <div className="abc-kpi-label">Custo total do estoque analisado</div>
          <div className="abc-kpi-value">{formatCurrency(total)}</div>
        </div>
        <div className="abc-kpi">
          <div className="abc-kpi-label">Itens analisados</div>
          <div className="abc-kpi-value">{analisaveis.length}</div>
        </div>
        <div className="abc-kpi">
          <div className="abc-kpi-label">Itens na Curva A</div>
          <div className="abc-kpi-value">{porClasse.A.produtos}</div>
        </div>
      </div>

      <div className="abc-grid">
        <div className="abc-panel">
          <div className="abc-panel-title">Classificação ABC</div>
          <table className="abc-table">
            <thead>
              <tr>
                <th>Curva</th>
                <th>Itens</th>
                <th>% Itens</th>
                <th>% Valor</th>
              </tr>
            </thead>
            <tbody>
              {(['A', 'B', 'C'] as Classe[]).map((c) => (
                <tr key={c}>
                  <td>
                    <span className={`abc-tag abc-tag-${c.toLowerCase()}`}>{c}</span>
                  </td>
                  <td>{porClasse[c].produtos}</td>
                  <td>{formatPct(analisaveis.length ? (porClasse[c].produtos / analisaveis.length) * 100 : 0)}</td>
                  <td>{formatPct(pctClasse(c))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td>{analisaveis.length}</td>
                <td>{formatPct(100)}</td>
                <td>{formatPct(100)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="abc-panel">
          <div className="abc-panel-title">Por classificação</div>
          <div
            className="abc-donut"
            style={{
              background: `conic-gradient(var(--abc-a) 0% ${gA}%, var(--abc-b) ${gA}% ${gA + gB}%, var(--abc-c) ${gA + gB}% 100%)`,
            }}
          >
            <div className="abc-donut-center">{formatCurrency(total)}</div>
          </div>
          <div className="abc-legend">
            <div className="abc-legend-item">
              <span className="abc-legend-dot" style={{ background: 'var(--abc-a)' }} />
              Curva A — {formatPct(gA)}
            </div>
            <div className="abc-legend-item">
              <span className="abc-legend-dot" style={{ background: 'var(--abc-b)' }} />
              Curva B — {formatPct(gB)}
            </div>
            <div className="abc-legend-item">
              <span className="abc-legend-dot" style={{ background: 'var(--abc-c)' }} />
              Curva C — {formatPct(gC)}
            </div>
          </div>
        </div>

        <div className="abc-panel">
          <div className="abc-panel-title">Por categoria</div>
          {porCategoria.map((c) => (
            <div key={c.nome} className="abc-bar-row">
              <span className="abc-bar-label" title={c.nome}>
                {c.nome}
              </span>
              <span className="abc-bar-track">
                <span
                  className="abc-bar-fill"
                  style={{ width: `${porCategoria[0]?.valor ? (c.valor / porCategoria[0].valor) * 100 : 0}%` }}
                />
              </span>
              <span className="abc-bar-value">{formatCurrency(c.valor)}</span>
            </div>
          ))}
          {porCategoria.length === 0 && (
            <p className="text-muted" style={{ fontSize: 12 }}>
              Sem dados.
            </p>
          )}
        </div>

        <div className="abc-panel">
          <div className="abc-panel-title">Por marca / fornecedor</div>
          {porMarca.map((m) => (
            <div key={m.nome} className="abc-bar-row">
              <span className="abc-bar-label" title={m.nome}>
                {m.nome}
              </span>
              <span className="abc-bar-track">
                <span
                  className="abc-bar-fill"
                  style={{ width: `${porMarca[0]?.valor ? (m.valor / porMarca[0].valor) * 100 : 0}%` }}
                />
              </span>
              <span className="abc-bar-value">{formatCurrency(m.valor)}</span>
            </div>
          ))}
          {porMarca.length === 0 && (
            <p className="text-muted" style={{ fontSize: 12 }}>
              Sem dados.
            </p>
          )}
        </div>
      </div>

      <div className="abc-panel">
        <div className="abc-panel-title">
          Curva de Pareto — top {topGrafico.length} de {analisaveis.length} itens por valor em estoque
        </div>
        {topGrafico.length === 0 ? (
          <p className="text-muted" style={{ fontSize: 12 }}>
            Nenhum item com custo cadastrado para gerar o gráfico.
          </p>
        ) : (
          <>
            <div className="abc-chart-scroll">
              <svg width={largura} height={altura} role="img" aria-label="Gráfico de curva de Pareto do estoque">
                {[0, 25, 50, 75, 100].map((p) => {
                  const y = altura - margemBase - (p / 100) * alturaBarras
                  return (
                    <g key={p}>
                      <line x1={margemEsquerda} x2={largura} y1={y} y2={y} stroke="var(--border-faint)" />
                      <text x={2} y={y - 3} fontSize={9} fill="var(--text-faint)">
                        {p}%
                      </text>
                    </g>
                  )
                })}
                {[LIMITE_A, LIMITE_B].map((p) => {
                  const y = altura - margemBase - (p / 100) * alturaBarras
                  return <line key={p} x1={margemEsquerda} x2={largura} y1={y} y2={y} stroke="var(--text-faint)" strokeDasharray="4,3" />
                })}
                {topGrafico.map((c, idx) => {
                  const x = idx * LARGURA_BARRA + margemEsquerda
                  const h = maiorValor > 0 ? (c.item.valor_total_estoque / maiorValor) * alturaBarras : 0
                  const nomeCurto = c.item.nome.length > 14 ? `${c.item.nome.slice(0, 13)}…` : c.item.nome
                  return (
                    <g key={c.item.id}>
                      <rect x={x} y={altura - margemBase - h} width={22} height={h} fill={corClasse[c.classe]} rx={2}>
                        <title>
                          {c.item.nome} — {formatCurrency(c.item.valor_total_estoque)} (Curva {c.classe})
                        </title>
                      </rect>
                      <text
                        x={x + 11}
                        y={altura - margemBase + 10}
                        fontSize={9}
                        fill="var(--text-muted)"
                        textAnchor="end"
                        transform={`rotate(-55 ${x + 11} ${altura - margemBase + 10})`}
                      >
                        {nomeCurto}
                      </text>
                    </g>
                  )
                })}
                <polyline
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  points={topGrafico
                    .map((c, idx) => {
                      const x = idx * LARGURA_BARRA + margemEsquerda + 11
                      const y = altura - margemBase - (c.pctAcumulado / 100) * alturaBarras
                      return `${x},${y}`
                    })
                    .join(' ')}
                />
              </svg>
            </div>
            <p className="abc-chart-note">
              Barras coloridas por classificação (verde = Curva A, roxo = Curva B, laranja = Curva C); a linha mostra o
              % acumulado do valor em estoque. As linhas tracejadas marcam os cortes de 80% e 95% usados para definir
              as curvas.
            </p>
          </>
        )}
      </div>

      <div className="modal-footer">
        <div />
        <div className="modal-footer-right">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
