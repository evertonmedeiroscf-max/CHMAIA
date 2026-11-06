'use client'

import { cloneElement, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import ColumnHeaderFilter from '@/components/ColumnHeaderFilter'
import ColumnManagerPanel, { type ColumnManagerColumn } from '@/components/ColumnManagerPanel'
import Pagination from '@/components/Pagination'
import { TIPOS_FICHA, TIPO_FICHA_LABEL } from '@/lib/types/domain'
import { formatCurrency, formatDateBR } from '@/lib/utils/format'
import { formatNumero } from '@/lib/utils/fichaTecnica'
import { computeRowMinWidth } from '@/lib/utils/columns'
import { useColumnPrefs } from '@/lib/hooks/useColumnPrefs'
import { useAjustarPagina } from '@/lib/hooks/useAjustarPagina'
import { excluirFichaTecnica } from './actions'
import type { FichaListada } from './listagem'

const COLUMN_LABELS: Record<string, string> = {
  nome: 'RECEITA',
  tipo: 'TIPO',
  rendimento_kg: 'RENDIMENTO',
  ingredientes: 'INGREDIENTES',
  custo_total: 'CUSTO TOTAL / PRATO',
  custo_kg: 'CUSTO DO KG',
  data_atualizacao: 'ATUALIZAÇÃO',
}

const COLUMN_WIDTHS: Record<string, string> = {
  nome: '1fr',
  tipo: '190px',
  rendimento_kg: '120px',
  ingredientes: '110px',
  custo_total: '150px',
  custo_kg: '120px',
  data_atualizacao: '120px',
}

const DEFAULT_ORDER = Object.keys(COLUMN_LABELS)
const ACAO_WIDTH = '130px'
const ITENS_POR_PAGINA = 15

const textoRendimento = (f: FichaListada) => (f.rendimento_kg !== null ? `${formatNumero(f.rendimento_kg, 3)} Kg` : '-')
const custoTotalTexto = (f: FichaListada) => formatCurrency(f.custo_total)
const custoKgTexto = (f: FichaListada) => (f.custo_kg !== null ? formatCurrency(f.custo_kg) : '-')

function opcoesUnicas(valores: string[]) {
  return Array.from(new Set(valores))
    .sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }))
    .map((v) => ({ value: v, label: v }))
}

// Tabela detalhada das fichas (com custos), com os filtros de coluna estilo
// Excel, paginação e escolha de colunas — a mesma convenção das outras abas.
export default function TabelaFichas({ fichas }: { fichas: FichaListada[] }) {
  const router = useRouter()
  const [filtroNome, setFiltroNome] = useState<string[]>([])
  const [filtroTipo, setFiltroTipo] = useState<string[]>([])
  const [filtroRendimento, setFiltroRendimento] = useState<string[]>([])
  const [filtroIngredientes, setFiltroIngredientes] = useState<string[]>([])
  const [filtroCustoTotal, setFiltroCustoTotal] = useState<string[]>([])
  const [filtroCustoKg, setFiltroCustoKg] = useState<string[]>([])
  const [filtroDataInicio, setFiltroDataInicio] = useState('')
  const [filtroDataFim, setFiltroDataFim] = useState('')
  const [paginaAtual, setPaginaAtual] = useState(1)
  const [excluindoId, setExcluindoId] = useState<string | null>(null)
  const [erroExcluir, setErroExcluir] = useState('')

  const { order, isVisible, toggleVisible, reorder } = useColumnPrefs('colunas:fichas-tecnicas', DEFAULT_ORDER)

  const opcoesNome = useMemo(() => opcoesUnicas(fichas.map((f) => f.nome)), [fichas])
  const opcoesRendimento = useMemo(() => opcoesUnicas(fichas.map(textoRendimento)), [fichas])
  const opcoesIngredientes = useMemo(() => opcoesUnicas(fichas.map((f) => String(f.ingredientes))), [fichas])
  const opcoesCustoTotal = useMemo(() => opcoesUnicas(fichas.map(custoTotalTexto)), [fichas])
  const opcoesCustoKg = useMemo(() => opcoesUnicas(fichas.map(custoKgTexto)), [fichas])

  const fichasFiltradas = useMemo(() => {
    return fichas
      .filter((f) => !filtroNome.length || filtroNome.includes(f.nome))
      .filter((f) => !filtroTipo.length || filtroTipo.includes(f.tipo))
      .filter((f) => !filtroRendimento.length || filtroRendimento.includes(textoRendimento(f)))
      .filter((f) => !filtroIngredientes.length || filtroIngredientes.includes(String(f.ingredientes)))
      .filter((f) => !filtroCustoTotal.length || filtroCustoTotal.includes(custoTotalTexto(f)))
      .filter((f) => !filtroCustoKg.length || filtroCustoKg.includes(custoKgTexto(f)))
      .filter((f) => !filtroDataInicio || (f.data_atualizacao !== null && f.data_atualizacao >= filtroDataInicio))
      .filter((f) => !filtroDataFim || (f.data_atualizacao !== null && f.data_atualizacao <= filtroDataFim))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [fichas, filtroNome, filtroTipo, filtroRendimento, filtroIngredientes, filtroCustoTotal, filtroCustoKg, filtroDataInicio, filtroDataFim])

  const totalPaginas = Math.max(1, Math.ceil(fichasFiltradas.length / ITENS_POR_PAGINA))
  // Volta pra página 1 só quando um filtro muda. Editar abre OUTRA tela, então a
  // página também é lembrada na sessão: ao voltar, a lista retoma de onde estava.
  useAjustarPagina({
    paginaAtual,
    setPaginaAtual,
    totalPaginas,
    filtros: [filtroNome, filtroTipo, filtroRendimento, filtroIngredientes, filtroCustoTotal, filtroCustoKg, filtroDataInicio, filtroDataFim],
    chaveArmazenamento: 'pagina:fichas-tecnicas',
  })
  const fichasPaginadas = useMemo(
    () => fichasFiltradas.slice((paginaAtual - 1) * ITENS_POR_PAGINA, paginaAtual * ITENS_POR_PAGINA),
    [fichasFiltradas, paginaAtual]
  )

  const columns: ColumnManagerColumn[] = [
    { key: 'nome', label: COLUMN_LABELS.nome, filter: { options: opcoesNome, selected: filtroNome, onChange: setFiltroNome } },
    {
      key: 'tipo',
      label: COLUMN_LABELS.tipo,
      filter: { options: TIPOS_FICHA.map((t) => ({ value: t, label: TIPO_FICHA_LABEL[t] })), selected: filtroTipo, onChange: setFiltroTipo },
    },
    {
      key: 'rendimento_kg',
      label: COLUMN_LABELS.rendimento_kg,
      filter: { options: opcoesRendimento, selected: filtroRendimento, onChange: setFiltroRendimento },
    },
    {
      key: 'ingredientes',
      label: COLUMN_LABELS.ingredientes,
      filter: { options: opcoesIngredientes, selected: filtroIngredientes, onChange: setFiltroIngredientes },
    },
    {
      key: 'custo_total',
      label: COLUMN_LABELS.custo_total,
      filter: { options: opcoesCustoTotal, selected: filtroCustoTotal, onChange: setFiltroCustoTotal },
    },
    {
      key: 'custo_kg',
      label: COLUMN_LABELS.custo_kg,
      filter: { options: opcoesCustoKg, selected: filtroCustoKg, onChange: setFiltroCustoKg },
    },
    {
      key: 'data_atualizacao',
      label: COLUMN_LABELS.data_atualizacao,
      dateRangeFilter: { from: filtroDataInicio, to: filtroDataFim, onChangeFrom: setFiltroDataInicio, onChangeTo: setFiltroDataFim },
    },
  ]

  const columnsByKey = new Map(columns.map((c) => [c.key, c]))
  const visibleOrder = order.filter(isVisible)
  const gridTemplate = [...visibleOrder.map((k) => COLUMN_WIDTHS[k]), ACAO_WIDTH].join(' ')
  const minWidth = computeRowMinWidth([...visibleOrder.map((k) => COLUMN_WIDTHS[k]), ACAO_WIDTH])

  async function handleExcluir(ficha: FichaListada) {
    if (!window.confirm(`Excluir a ficha técnica "${ficha.nome}"?\n\nEsta ação não pode ser desfeita.`)) return
    setErroExcluir('')
    setExcluindoId(ficha.id)
    const resultado = await excluirFichaTecnica(ficha.id)
    setExcluindoId(null)
    if ('error' in resultado) setErroExcluir(resultado.error)
    else router.refresh()
  }

  function renderCell(key: string, f: FichaListada) {
    switch (key) {
      case 'nome':
        return (
          <div className="text-strong">
            <Link href={`/fichas-tecnicas/${f.id}`} className="ficha-link-nome">
              {f.nome}
            </Link>
            {(f.sem_origem > 0 || f.incompletas > 0) && (
              <span
                className="ficha-aviso-preco"
                title={
                  f.sem_origem > 0
                    ? `${f.sem_origem} linha(s) com NÃO CONSEGUIU OBTER INFORMAÇÃO DO ARQUIVO`
                    : `${f.incompletas} linha(s) fora do custo (custo parcial)`
                }
              >
                {' '}
                ⚠
              </span>
            )}
          </div>
        )
      case 'tipo':
        return <div className="col-center text-muted">{TIPO_FICHA_LABEL[f.tipo]}</div>
      case 'rendimento_kg':
        return <div className="col-center text-muted">{textoRendimento(f)}</div>
      case 'ingredientes':
        return <div className="col-center text-muted">{f.ingredientes}</div>
      case 'custo_total':
        return (
          <div className="col-center">
            {custoTotalTexto(f)}
            {f.incompletas > 0 && (
              <span className="ficha-aviso-preco" title={`${f.incompletas} linha(s) fora do custo: o valor é parcial`}>
                {' '}
                ⚠
              </span>
            )}
          </div>
        )
      case 'custo_kg':
        return <div className="col-center">{custoKgTexto(f)}</div>
      case 'data_atualizacao':
        return <div className="col-center text-muted">{f.data_atualizacao ? formatDateBR(f.data_atualizacao) : '-'}</div>
      default:
        return <div />
    }
  }

  return (
    <div>
      <div className="toolbar" style={{ justifyContent: 'flex-end' }}>
        <ColumnManagerPanel columns={columns} order={order} isVisible={isVisible} onToggleVisible={toggleVisible} onReorder={reorder} />
      </div>

      {erroExcluir && (
        <p className="form-error" style={{ marginBottom: 12 }}>
          {erroExcluir}
        </p>
      )}

      <div className="data-table table-scroll">
        <div className="table-row table-head" style={{ gridTemplateColumns: gridTemplate, minWidth }}>
          {visibleOrder.map((key) => {
            const col = columnsByKey.get(key)
            return (
              <div key={key} className="col-filter" style={{ justifyContent: key === 'nome' ? 'flex-start' : 'center' }}>
                <span>{COLUMN_LABELS[key]}</span>
                <ColumnHeaderFilter filter={col?.filter} dateRangeFilter={col?.dateRangeFilter} />
              </div>
            )
          })}
          <div></div>
        </div>

        {fichasPaginadas.map((f) => (
          <div key={f.id} className="table-row" style={{ gridTemplateColumns: gridTemplate, minWidth }}>
            {visibleOrder.map((key) => cloneElement(renderCell(key, f), { key }))}
            <div className="col-center" style={{ display: 'flex', gap: 14, justifyContent: 'center' }}>
              <Link href={`/fichas-tecnicas/${f.id}/editar`} className="action-link">
                editar
              </Link>
              <button type="button" className="action-link danger" onClick={() => handleExcluir(f)} disabled={excluindoId === f.id}>
                {excluindoId === f.id ? 'excluindo...' : 'excluir'}
              </button>
            </div>
          </div>
        ))}

        {fichasFiltradas.length === 0 && <div className="empty-state">Nenhuma ficha técnica cadastrada ainda.</div>}
      </div>

      <Pagination
        paginaAtual={paginaAtual}
        totalPaginas={totalPaginas}
        totalItens={fichasFiltradas.length}
        itensPorPagina={ITENS_POR_PAGINA}
        onChange={setPaginaAtual}
      />
    </div>
  )
}
