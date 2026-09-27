'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { MESES, MESES_CURTOS } from './analise'

const MARGEM = { top: 16, right: 12, bottom: 28, left: 64 }

function useLargura() {
  const ref = useRef<HTMLDivElement>(null)
  const [largura, setLargura] = useState(640)
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) => setLargura(e.contentRect.width))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, largura] as const
}

// Passo "redondo" (1, 2, 2.5, 5 × 10^n) para ~4 linhas de grade.
function escala(min: number, max: number) {
  const bruto = (max - min) / 4 || 1
  const mag = 10 ** Math.floor(Math.log10(bruto))
  const passo = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((p) => p >= bruto)!
  const ini = Math.floor(min / passo) * passo
  const fim = Math.ceil(max / passo) * passo
  const ticks: number[] = []
  for (let v = ini; v <= fim + passo / 2; v += passo) ticks.push(v)
  return { ini, fim, ticks }
}

export const moedaCompacta = (v: number) =>
  Math.abs(v) >= 1000 ? `R$ ${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mil` : `R$ ${v.toFixed(0)}`

// Barra com o topo arredondado (4px) e a base reta presa na linha zero.
function barra(x: number, y0: number, y1: number, w: number) {
  const r = Math.min(4, w / 2, Math.abs(y1 - y0))
  if (y1 <= y0) {
    return `M${x},${y0}V${y1 + r}Q${x},${y1} ${x + r},${y1}H${x + w - r}Q${x + w},${y1} ${x + w},${y1 + r}V${y0}Z`
  }
  return `M${x},${y0}V${y1 - r}Q${x},${y1} ${x + r},${y1}H${x + w - r}Q${x + w},${y1} ${x + w},${y1 - r}V${y0}Z`
}

function Tooltip({ x, largura, children }: { x: number; largura: number; children: ReactNode }) {
  const aDireita = x < largura / 2
  return (
    <div className="chart-tooltip" style={aDireita ? { left: x + 12 } : { right: largura - x + 12 }}>
      {children}
    </div>
  )
}

export type SerieLinha = { nome: string; cor: string; valores: (number | null)[]; destaque?: boolean }

export function GraficoLinhas({
  series,
  formatar,
  altura = 280,
}: {
  series: SerieLinha[]
  formatar: (v: number) => string
  altura?: number
}) {
  const [ref, largura] = useLargura()
  const [hover, setHover] = useState<number | null>(null)
  const plotW = largura - MARGEM.left - MARGEM.right
  const plotH = altura - MARGEM.top - MARGEM.bottom
  const todos = series.flatMap((s) => s.valores.filter((v): v is number => v != null))
  const { ini, fim, ticks } = escala(0, Math.max(...todos, 1))
  const colW = plotW / 12
  const x = (i: number) => MARGEM.left + colW * (i + 0.5)
  const y = (v: number) => MARGEM.top + plotH - ((v - ini) / (fim - ini)) * plotH

  const caminho = (valores: (number | null)[]) => {
    let d = ''
    let caneta = false
    valores.forEach((v, i) => {
      if (v == null) {
        caneta = false
        return
      }
      d += `${caneta ? 'L' : 'M'}${x(i)},${y(v)}`
      caneta = true
    })
    return d
  }

  // Séries desenhadas do menos ao mais importante: a em destaque fica por cima.
  const ordenadas = [...series].sort((a, b) => Number(!!a.destaque) - Number(!!b.destaque))

  return (
    <div ref={ref} className="chart-area" onMouseLeave={() => setHover(null)}>
      <svg width={largura} height={altura} role="img" aria-label="Faturamento mensal por ano">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={MARGEM.left} x2={largura - MARGEM.right} y1={y(t)} y2={y(t)} className="chart-grid" />
            <text x={MARGEM.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="chart-axis">
              {moedaCompacta(t)}
            </text>
          </g>
        ))}
        {MESES_CURTOS.map((m, i) => (
          <text key={m} x={x(i)} y={altura - 8} textAnchor="middle" className="chart-axis">
            {colW < 34 ? m[0] : m}
          </text>
        ))}
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={MARGEM.top} y2={MARGEM.top + plotH} className="chart-crosshair" />}
        {ordenadas.map((s) => (
          <path
            key={s.nome}
            d={caminho(s.valores)}
            fill="none"
            stroke={s.cor}
            strokeWidth={s.destaque ? 3 : 2}
            strokeOpacity={s.destaque || hover != null ? 1 : 0.75}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
        {ordenadas.map((s) =>
          s.valores.map((v, i) =>
            v != null && (s.destaque || hover === i) ? (
              <circle key={`${s.nome}-${i}`} cx={x(i)} cy={y(v)} r={hover === i ? 5 : 4} fill={s.cor} className="chart-dot" />
            ) : null
          )
        )}
        {MESES.map((_, i) => (
          <rect
            key={i}
            x={MARGEM.left + colW * i}
            y={MARGEM.top}
            width={colW}
            height={plotH}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
            onTouchStart={() => setHover(i)}
          />
        ))}
      </svg>
      {hover != null && (
        <Tooltip x={x(hover)} largura={largura}>
          <div className="chart-tooltip-title">{MESES[hover]}</div>
          {[...series].reverse().map((s) => (
            <div key={s.nome} className="chart-tooltip-row">
              <span className="chart-swatch" style={{ background: s.cor }} />
              <span>{s.nome}</span>
              <strong>{s.valores[hover] != null ? formatar(s.valores[hover]!) : '—'}</strong>
            </div>
          ))}
        </Tooltip>
      )}
    </div>
  )
}

export function GraficoBarras({
  valores,
  cor,
  formatar,
  formatarEixo = formatar,
  rotulo,
  altura = 220,
  detalhe,
}: {
  valores: (number | null)[]
  cor: (v: number) => string
  formatar: (v: number) => string
  formatarEixo?: (v: number) => string
  rotulo: string
  altura?: number
  detalhe?: (i: number) => ReactNode
}) {
  const [ref, largura] = useLargura()
  const [hover, setHover] = useState<number | null>(null)
  const plotW = largura - MARGEM.left - MARGEM.right
  const plotH = altura - MARGEM.top - MARGEM.bottom
  const nums = valores.filter((v): v is number => v != null)
  const { ini, fim, ticks } = escala(Math.min(0, ...nums), Math.max(0, ...nums, 0.0001))
  const colW = plotW / 12
  const barW = Math.max(6, Math.min(36, colW - 8))
  const y = (v: number) => MARGEM.top + plotH - ((v - ini) / (fim - ini)) * plotH
  const cx = (i: number) => MARGEM.left + colW * (i + 0.5)

  // Rótulo direto só nos extremos (maior e menor), o resto fica no hover.
  const idxMax = nums.length ? valores.indexOf(Math.max(...nums)) : -1
  const idxMin = nums.length > 1 ? valores.indexOf(Math.min(...nums)) : -1

  return (
    <div ref={ref} className="chart-area" onMouseLeave={() => setHover(null)}>
      <svg width={largura} height={altura} role="img" aria-label={rotulo}>
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={MARGEM.left}
              x2={largura - MARGEM.right}
              y1={y(t)}
              y2={y(t)}
              className={t === 0 ? 'chart-baseline' : 'chart-grid'}
            />
            <text x={MARGEM.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="chart-axis">
              {formatarEixo(t)}
            </text>
          </g>
        ))}
        {MESES_CURTOS.map((m, i) => (
          <text key={m} x={cx(i)} y={altura - 8} textAnchor="middle" className="chart-axis">
            {colW < 34 ? m[0] : m}
          </text>
        ))}
        {valores.map((v, i) =>
          v == null ? null : (
            <g key={i}>
              <path
                d={barra(cx(i) - barW / 2, y(0), y(v), barW)}
                fill={cor(v)}
                fillOpacity={hover == null || hover === i ? 1 : 0.55}
              />
            </g>
          )
        )}
        {hover == null &&
          [idxMax, idxMin].map((i) => {
            const v = i >= 0 ? valores[i] : null
            if (v == null) return null
            return (
              <text key={`rotulo-${i}`} x={cx(i)} y={v >= 0 ? y(v) - 6 : y(v) + 14} textAnchor="middle" className="chart-label">
                {formatar(v)}
              </text>
            )
          })}
        {valores.map((v, i) => (
          <rect
            key={i}
            x={MARGEM.left + colW * i}
            y={MARGEM.top}
            width={colW}
            height={plotH}
            fill="transparent"
            onMouseEnter={() => setHover(v == null ? null : i)}
            onTouchStart={() => setHover(v == null ? null : i)}
          />
        ))}
      </svg>
      {hover != null && valores[hover] != null && (
        <Tooltip x={cx(hover)} largura={largura}>
          <div className="chart-tooltip-title">{MESES[hover]}</div>
          <div className="chart-tooltip-row">
            <span>{rotulo}</span>
            <strong>{formatar(valores[hover]!)}</strong>
          </div>
          {detalhe?.(hover)}
        </Tooltip>
      )}
    </div>
  )
}
