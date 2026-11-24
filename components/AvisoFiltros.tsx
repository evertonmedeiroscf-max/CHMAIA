'use client'

import type { ColumnManagerColumn } from '@/components/ColumnManagerPanel'
import { formatDateBR } from '@/lib/utils/format'

// Um filtro que está ligado na tela: o texto do chip e como desligar.
export type FiltroAtivo = { chave: string; rotulo: string; limpar: () => void }

// Lê as colunas de uma aba de lista (o mesmo vetor `columns` que alimenta o menu ▾
// do cabeçalho e o painel "Colunas") e devolve só os filtros que estão ligados.
export function filtrosAtivosDasColunas(colunas: ColumnManagerColumn[]): FiltroAtivo[] {
  const ativos: FiltroAtivo[] = []
  for (const col of colunas) {
    const f = col.filter
    if (f && f.selected.length > 0) {
      const nomes = f.selected.map((v) => f.options.find((o) => o.value === v)?.label ?? v)
      const resumo = nomes.length <= 2 ? nomes.join(', ') : `${nomes.slice(0, 2).join(', ')} +${nomes.length - 2}`
      ativos.push({ chave: `${col.key}-opcoes`, rotulo: `${col.label}: ${resumo}`, limpar: () => f.onChange([]) })
    }
    const d = col.dateRangeFilter
    if (d && (d.from || d.to)) {
      const periodo = d.from ? `${formatDateBR(d.from)} – ${d.to ? formatDateBR(d.to) : '...'}` : `até ${formatDateBR(d.to)}`
      ativos.push({
        chave: `${col.key}-periodo`,
        rotulo: `${col.label}: ${periodo}`,
        limpar: () => {
          d.onChangeFrom('')
          d.onChangeTo('')
        },
      })
    }
  }
  return ativos
}

// Faixa que aparece SÓ quando há filtro ligado, logo acima da tabela: mostra quais
// filtros estão valendo (cada chip desliga o seu) e um botão para limpar todos.
// Convenção do projeto: toda aba com filtros usa este aviso — nas abas de lista com
// colunas, basta `<AvisoFiltros colunas={columns} />`; nas demais, passe `ativos`.
export default function AvisoFiltros({ colunas, ativos }: { colunas?: ColumnManagerColumn[]; ativos?: FiltroAtivo[] }) {
  const lista = ativos ?? (colunas ? filtrosAtivosDasColunas(colunas) : [])
  if (lista.length === 0) return null

  return (
    <div className="aviso-filtros" role="status">
      <span className="aviso-filtros-titulo">{lista.length === 1 ? '1 filtro ativo' : `${lista.length} filtros ativos`}</span>
      <div className="aviso-filtros-lista">
        {lista.map((f) => (
          <button key={f.chave} type="button" className="aviso-filtros-chip" onClick={f.limpar} title="Clique para remover este filtro">
            <span>{f.rotulo}</span>
            <span aria-hidden="true">✕</span>
          </button>
        ))}
      </div>
      <button type="button" className="aviso-filtros-limpar" onClick={() => lista.forEach((f) => f.limpar())}>
        Limpar filtros
      </button>
    </div>
  )
}
