'use client'

import { cloneElement, useEffect, useMemo, useState } from 'react'
import ColumnManagerPanel, { type ColumnManagerColumn } from '@/components/ColumnManagerPanel'
import Modal from '@/components/Modal'
import Pagination from '@/components/Pagination'
import ProdutoForm from './ProdutoForm'
import { TIPOS_PRODUTO, type Produto } from '@/lib/types/domain'
import { formatCurrency } from '@/lib/utils/format'
import { computeRowMinWidth } from '@/lib/utils/columns'
import { useColumnPrefs } from '@/lib/hooks/useColumnPrefs'
import { alternarAtivoProduto } from './actions'

const TIPO_LABEL: Record<string, string> = {
  comida: 'Comida',
  servico: 'Serviço',
}

const COLUMN_LABELS: Record<string, string> = {
  nome: 'NOME',
  tipo: 'TIPO',
  categoria: 'CATEGORIA',
  peso_kg_padrao: 'PESO PADRÃO',
  valor_unit_padrao: 'VALOR UNIT.',
  ativo: 'ATIVO',
}

const COLUMN_WIDTHS: Record<string, string> = {
  nome: '1fr',
  tipo: '110px',
  categoria: '160px',
  peso_kg_padrao: '110px',
  valor_unit_padrao: '110px',
  ativo: '80px',
}

const DEFAULT_ORDER = Object.keys(COLUMN_LABELS)
const ACAO_WIDTH = '70px'
const ITENS_POR_PAGINA = 15

export default function ProdutosClient({ produtos }: { produtos: Produto[] }) {
  const [filtroTipo, setFiltroTipo] = useState<string[]>([])
  const [filtroCategoria, setFiltroCategoria] = useState<string[]>([])
  const [filtroAtivo, setFiltroAtivo] = useState<string[]>([])
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<Produto | undefined>(undefined)
  const [paginaAtual, setPaginaAtual] = useState(1)

  const { order, isVisible, toggleVisible, reorder } = useColumnPrefs('colunas:produtos', DEFAULT_ORDER)

  const opcoesCategoria = useMemo(
    () =>
      Array.from(new Set(produtos.map((p) => p.categoria).filter((c): c is string => !!c)))
        .sort()
        .map((c) => ({ value: c, label: c })),
    [produtos]
  )

  const produtosFiltrados = useMemo(() => {
    return produtos
      .filter((p) => !filtroTipo.length || filtroTipo.includes(p.tipo))
      .filter((p) => !filtroCategoria.length || filtroCategoria.includes(p.categoria ?? ''))
      .filter((p) => !filtroAtivo.length || filtroAtivo.includes(p.ativo ? 'S' : 'N'))
      .sort((a, b) => a.nome.localeCompare(b.nome))
  }, [produtos, filtroTipo, filtroCategoria, filtroAtivo])

  useEffect(() => {
    setPaginaAtual(1)
  }, [produtosFiltrados])

  const totalPaginas = Math.max(1, Math.ceil(produtosFiltrados.length / ITENS_POR_PAGINA))
  const produtosPaginados = useMemo(
    () => produtosFiltrados.slice((paginaAtual - 1) * ITENS_POR_PAGINA, paginaAtual * ITENS_POR_PAGINA),
    [produtosFiltrados, paginaAtual]
  )

  const columns: ColumnManagerColumn[] = [
    { key: 'nome', label: COLUMN_LABELS.nome },
    {
      key: 'tipo',
      label: COLUMN_LABELS.tipo,
      filter: { options: TIPOS_PRODUTO.map((t) => ({ value: t, label: TIPO_LABEL[t] })), selected: filtroTipo, onChange: setFiltroTipo },
    },
    {
      key: 'categoria',
      label: COLUMN_LABELS.categoria,
      filter: { options: opcoesCategoria, selected: filtroCategoria, onChange: setFiltroCategoria },
    },
    { key: 'peso_kg_padrao', label: COLUMN_LABELS.peso_kg_padrao },
    { key: 'valor_unit_padrao', label: COLUMN_LABELS.valor_unit_padrao },
    {
      key: 'ativo',
      label: COLUMN_LABELS.ativo,
      filter: {
        options: [
          { value: 'S', label: 'Sim' },
          { value: 'N', label: 'Não' },
        ],
        selected: filtroAtivo,
        onChange: setFiltroAtivo,
      },
    },
  ]

  const visibleOrder = order.filter(isVisible)
  const gridTemplate = [...visibleOrder.map((k) => COLUMN_WIDTHS[k]), ACAO_WIDTH].join(' ')
  const minWidth = computeRowMinWidth([...visibleOrder.map((k) => COLUMN_WIDTHS[k]), ACAO_WIDTH])

  function abrirNovo() {
    setEditando(undefined)
    setModalAberto(true)
  }

  function abrirEdicao(produto: Produto) {
    setEditando(produto)
    setModalAberto(true)
  }

  async function alternarAtivo(produto: Produto) {
    await alternarAtivoProduto(produto.id, !produto.ativo)
  }

  function renderCell(key: string, p: Produto) {
    switch (key) {
      case 'nome':
        return <div className="text-strong">{p.nome}</div>
      case 'tipo':
        return <div className="col-center text-muted">{TIPO_LABEL[p.tipo]}</div>
      case 'categoria':
        return <div className="col-center text-muted">{p.categoria ?? '-'}</div>
      case 'peso_kg_padrao':
        return <div className="col-center text-muted">{p.peso_kg_padrao ?? '-'}</div>
      case 'valor_unit_padrao':
        return <div className="col-center">{formatCurrency(p.valor_unit_padrao)}</div>
      case 'ativo':
        return (
          <div className="col-center">
            <span className={`badge ${p.ativo ? 'badge-pago' : 'badge-pendente'}`}>{p.ativo ? 'SIM' : 'NÃO'}</span>
          </div>
        )
      default:
        return <div />
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Produtos</h1>
        <button type="button" className="btn-primary" onClick={abrirNovo}>
          + Novo produto
        </button>
      </div>

      <p className="modal-item-label" style={{ marginBottom: 16 }}>
        Catálogo de itens de cardápio e serviço reaproveitável ao montar um Orçamento — cadastre aqui uma vez e escolha
        direto na lista ao adicionar itens, em vez de digitar tudo de novo.
      </p>

      <div className="toolbar" style={{ justifyContent: 'flex-end' }}>
        <ColumnManagerPanel columns={columns} order={order} isVisible={isVisible} onToggleVisible={toggleVisible} onReorder={reorder} />
      </div>

      <div className="data-table table-scroll">
        <div className="table-row table-head" style={{ gridTemplateColumns: gridTemplate, minWidth }}>
          {visibleOrder.map((key) => (
            <div key={key} className={key === 'nome' ? undefined : 'col-center'}>
              {COLUMN_LABELS[key]}
            </div>
          ))}
          <div></div>
        </div>

        {produtosPaginados.map((p) => (
          <div key={p.id} className="table-row" style={{ gridTemplateColumns: gridTemplate, minWidth }}>
            {visibleOrder.map((key) => cloneElement(renderCell(key, p), { key }))}
            <div className="col-center" style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button type="button" className="action-link" onClick={() => abrirEdicao(p)}>
                editar
              </button>
              <button type="button" className="action-link" onClick={() => alternarAtivo(p)}>
                {p.ativo ? 'desativar' : 'ativar'}
              </button>
            </div>
          </div>
        ))}

        {produtosFiltrados.length === 0 && <div className="empty-state">Nenhum produto cadastrado.</div>}
      </div>

      <Pagination
        paginaAtual={paginaAtual}
        totalPaginas={totalPaginas}
        totalItens={produtosFiltrados.length}
        itensPorPagina={ITENS_POR_PAGINA}
        onChange={setPaginaAtual}
      />

      {modalAberto && (
        <Modal title={editando ? 'Editar produto' : 'Novo produto'} onClose={() => setModalAberto(false)}>
          <ProdutoForm key={editando?.id ?? 'novo'} produto={editando} onClose={() => setModalAberto(false)} />
        </Modal>
      )}
    </div>
  )
}
