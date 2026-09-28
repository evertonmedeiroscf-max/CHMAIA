'use client'

import { cloneElement, useEffect, useMemo, useState, useTransition } from 'react'
import ColumnHeaderFilter from '@/components/ColumnHeaderFilter'
import ColumnManagerPanel, { type ColumnManagerColumn } from '@/components/ColumnManagerPanel'
import Modal from '@/components/Modal'
import Pagination from '@/components/Pagination'
import OrcamentoForm from './OrcamentoForm'
import { ENTIDADE_LABEL, ENTIDADE_TIPOS, STATUS_ORCAMENTO, type Orcamento, type Produto } from '@/lib/types/domain'
import { formatCurrency, formatDateBR } from '@/lib/utils/format'
import { computeRowMinWidth } from '@/lib/utils/columns'
import { useColumnPrefs } from '@/lib/hooks/useColumnPrefs'
import { converterEmPedido } from './actions'

const STATUS_LABEL: Record<string, string> = {
  pendente: 'PENDENTE',
  aprovado: 'APROVADO',
  recusado: 'RECUSADO',
}

// Reaproveita as cores já existentes: aprovado ~ pago (verde), pendente ~
// 50% pago (âmbar, neutro), recusado ~ pendente de pedido (vermelho).
const STATUS_BADGE_CLASS: Record<string, string> = {
  pendente: 'badge-50pago',
  aprovado: 'badge-pago',
  recusado: 'badge-pendente',
}

const COLUMN_LABELS: Record<string, string> = {
  numero: 'Nº',
  data_orcamento: 'DATA DO ORÇAMENTO',
  cliente: 'CLIENTE',
  entidade: 'ENT.',
  data_evento: 'DATA DO EVENTO',
  hora_evento: 'HORA DO EVENTO',
  descricao: 'DESCRIÇÃO',
  numero_pessoas: 'PESSOAS',
  valor_total: 'VALOR',
  valor_por_pessoa: 'VALOR/PESSOA',
  validade: 'VALIDADE',
  status: 'STATUS',
}

const COLUMN_WIDTHS: Record<string, string> = {
  numero: '44px',
  data_orcamento: '130px',
  cliente: '1fr',
  entidade: '55px',
  data_evento: '110px',
  hora_evento: '100px',
  descricao: '1fr',
  numero_pessoas: '90px',
  valor_total: '110px',
  valor_por_pessoa: '110px',
  validade: '110px',
  status: '100px',
}

const DEFAULT_ORDER = Object.keys(COLUMN_LABELS)
const ACAO_WIDTH = '150px'
const ITENS_POR_PAGINA = 15

export default function OrcamentosClient({ orcamentos, produtos }: { orcamentos: Orcamento[]; produtos: Produto[] }) {
  const [filtroNumero, setFiltroNumero] = useState<string[]>([])
  const [filtroDataInicio, setFiltroDataInicio] = useState('')
  const [filtroDataFim, setFiltroDataFim] = useState('')
  const [filtroCliente, setFiltroCliente] = useState<string[]>([])
  const [filtroEntidade, setFiltroEntidade] = useState<string[]>([])
  const [filtroDataEventoInicio, setFiltroDataEventoInicio] = useState('')
  const [filtroDataEventoFim, setFiltroDataEventoFim] = useState('')
  const [filtroHoraEvento, setFiltroHoraEvento] = useState<string[]>([])
  const [filtroDescricao, setFiltroDescricao] = useState<string[]>([])
  const [filtroNumeroPessoas, setFiltroNumeroPessoas] = useState<string[]>([])
  const [filtroValorTotal, setFiltroValorTotal] = useState<string[]>([])
  const [filtroValorPorPessoa, setFiltroValorPorPessoa] = useState<string[]>([])
  const [filtroValidadeInicio, setFiltroValidadeInicio] = useState('')
  const [filtroValidadeFim, setFiltroValidadeFim] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<string[]>([])
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<Orcamento | undefined>(undefined)
  // Depois de salvar, o modal continua aberto no orçamento salvo (com o
  // botão "Gerar proposta"); quando a lista recarrega do servidor, troca
  // `editando` pela versão gravada — num orçamento novo isso remonta o
  // formulário já em modo edição.
  const [salvoId, setSalvoId] = useState<string | null>(null)
  useEffect(() => {
    if (!salvoId) return
    const salvo = orcamentos.find((o) => o.id === salvoId)
    if (salvo) setEditando(salvo)
  }, [orcamentos, salvoId])
  const [convertendoId, setConvertendoId] = useState<string | null>(null)
  const [erroConversao, setErroConversao] = useState('')
  const [, startTransition] = useTransition()
  const [paginaAtual, setPaginaAtual] = useState(1)

  const { order, isVisible, toggleVisible, reorder } = useColumnPrefs('colunas:orcamentos', DEFAULT_ORDER)

  const opcoesCliente = useMemo(
    () =>
      Array.from(new Set(orcamentos.map((o) => o.cliente)))
        .sort()
        .map((c) => ({ value: c, label: c })),
    [orcamentos]
  )

  function opcoesTexto(getter: (o: Orcamento) => string | null) {
    return Array.from(new Set(orcamentos.map(getter).filter((v): v is string => !!v)))
      .sort((a, b) => a.localeCompare(b, 'pt-BR'))
      .map((v) => ({ value: v, label: v }))
  }
  function opcoesNumero(getter: (o: Orcamento) => number | null, formatar: (v: number) => string) {
    return Array.from(new Set(orcamentos.map(getter).filter((v): v is number => v !== null && v !== undefined)))
      .sort((a, b) => a - b)
      .map((v) => ({ value: String(v), label: formatar(v) }))
  }

  const opcoesNumeroOrcamento = useMemo(() => opcoesNumero((o) => o.numero, (v) => String(v)), [orcamentos])
  const opcoesHoraEvento = useMemo(() => opcoesTexto((o) => (o.hora_evento ? o.hora_evento.slice(0, 5) : null)), [orcamentos])
  const opcoesDescricao = useMemo(() => opcoesTexto((o) => o.descricao), [orcamentos])
  const opcoesNumeroPessoas = useMemo(() => opcoesNumero((o) => o.numero_pessoas, (v) => String(v)), [orcamentos])
  const opcoesValorTotal = useMemo(() => opcoesNumero((o) => o.valor_total, formatCurrency), [orcamentos])
  const opcoesValorPorPessoa = useMemo(
    () => opcoesNumero((o) => (o.numero_pessoas ? o.valor_total / o.numero_pessoas : null), formatCurrency),
    [orcamentos]
  )

  const orcamentosFiltrados = useMemo(() => {
    return orcamentos
      .filter((o) => !filtroNumero.length || filtroNumero.includes(String(o.numero)))
      .filter((o) => !filtroDataInicio || o.data_orcamento >= filtroDataInicio)
      .filter((o) => !filtroDataFim || o.data_orcamento <= filtroDataFim)
      .filter((o) => !filtroCliente.length || filtroCliente.includes(o.cliente))
      .filter((o) => !filtroEntidade.length || filtroEntidade.includes(o.entidade))
      .filter((o) => !filtroDataEventoInicio || (!!o.data_evento && o.data_evento >= filtroDataEventoInicio))
      .filter((o) => !filtroDataEventoFim || (!!o.data_evento && o.data_evento <= filtroDataEventoFim))
      .filter((o) => !filtroHoraEvento.length || filtroHoraEvento.includes(o.hora_evento ? o.hora_evento.slice(0, 5) : ''))
      .filter((o) => !filtroDescricao.length || filtroDescricao.includes(o.descricao ?? ''))
      .filter((o) => !filtroNumeroPessoas.length || filtroNumeroPessoas.includes(String(o.numero_pessoas ?? '')))
      .filter((o) => !filtroValorTotal.length || filtroValorTotal.includes(String(o.valor_total)))
      .filter(
        (o) =>
          !filtroValorPorPessoa.length ||
          filtroValorPorPessoa.includes(String(o.numero_pessoas ? o.valor_total / o.numero_pessoas : ''))
      )
      .filter((o) => !filtroValidadeInicio || (!!o.validade && o.validade >= filtroValidadeInicio))
      .filter((o) => !filtroValidadeFim || (!!o.validade && o.validade <= filtroValidadeFim))
      .filter((o) => !filtroStatus.length || filtroStatus.includes(o.status))
      .sort((a, b) => b.data_orcamento.localeCompare(a.data_orcamento) || b.numero - a.numero)
  }, [
    orcamentos,
    filtroNumero,
    filtroDataInicio,
    filtroDataFim,
    filtroCliente,
    filtroEntidade,
    filtroDataEventoInicio,
    filtroDataEventoFim,
    filtroHoraEvento,
    filtroDescricao,
    filtroNumeroPessoas,
    filtroValorTotal,
    filtroValorPorPessoa,
    filtroValidadeInicio,
    filtroValidadeFim,
    filtroStatus,
  ])

  useEffect(() => {
    setPaginaAtual(1)
  }, [orcamentosFiltrados])

  const totalPaginas = Math.max(1, Math.ceil(orcamentosFiltrados.length / ITENS_POR_PAGINA))
  const orcamentosPaginados = useMemo(
    () => orcamentosFiltrados.slice((paginaAtual - 1) * ITENS_POR_PAGINA, paginaAtual * ITENS_POR_PAGINA),
    [orcamentosFiltrados, paginaAtual]
  )

  const columns: ColumnManagerColumn[] = [
    { key: 'numero', label: COLUMN_LABELS.numero, filter: { options: opcoesNumeroOrcamento, selected: filtroNumero, onChange: setFiltroNumero } },
    {
      key: 'data_orcamento',
      label: COLUMN_LABELS.data_orcamento,
      dateRangeFilter: { from: filtroDataInicio, to: filtroDataFim, onChangeFrom: setFiltroDataInicio, onChangeTo: setFiltroDataFim },
    },
    { key: 'cliente', label: COLUMN_LABELS.cliente, filter: { options: opcoesCliente, selected: filtroCliente, onChange: setFiltroCliente } },
    {
      key: 'entidade',
      label: COLUMN_LABELS.entidade,
      filter: { options: ENTIDADE_TIPOS.map((t) => ({ value: t, label: ENTIDADE_LABEL[t] })), selected: filtroEntidade, onChange: setFiltroEntidade },
    },
    {
      key: 'data_evento',
      label: COLUMN_LABELS.data_evento,
      dateRangeFilter: {
        from: filtroDataEventoInicio,
        to: filtroDataEventoFim,
        onChangeFrom: setFiltroDataEventoInicio,
        onChangeTo: setFiltroDataEventoFim,
      },
    },
    { key: 'hora_evento', label: COLUMN_LABELS.hora_evento, filter: { options: opcoesHoraEvento, selected: filtroHoraEvento, onChange: setFiltroHoraEvento } },
    { key: 'descricao', label: COLUMN_LABELS.descricao, filter: { options: opcoesDescricao, selected: filtroDescricao, onChange: setFiltroDescricao } },
    {
      key: 'numero_pessoas',
      label: COLUMN_LABELS.numero_pessoas,
      filter: { options: opcoesNumeroPessoas, selected: filtroNumeroPessoas, onChange: setFiltroNumeroPessoas },
    },
    { key: 'valor_total', label: COLUMN_LABELS.valor_total, filter: { options: opcoesValorTotal, selected: filtroValorTotal, onChange: setFiltroValorTotal } },
    {
      key: 'valor_por_pessoa',
      label: COLUMN_LABELS.valor_por_pessoa,
      filter: { options: opcoesValorPorPessoa, selected: filtroValorPorPessoa, onChange: setFiltroValorPorPessoa },
    },
    {
      key: 'validade',
      label: COLUMN_LABELS.validade,
      dateRangeFilter: { from: filtroValidadeInicio, to: filtroValidadeFim, onChangeFrom: setFiltroValidadeInicio, onChangeTo: setFiltroValidadeFim },
    },
    {
      key: 'status',
      label: COLUMN_LABELS.status,
      filter: {
        options: STATUS_ORCAMENTO.map((s) => ({ value: s, label: STATUS_LABEL[s] })),
        selected: filtroStatus,
        onChange: setFiltroStatus,
      },
    },
  ]

  const columnsByKey = new Map(columns.map((c) => [c.key, c]))
  const visibleOrder = order.filter(isVisible)
  const gridTemplate = [...visibleOrder.map((k) => COLUMN_WIDTHS[k]), ACAO_WIDTH].join(' ')
  const minWidth = computeRowMinWidth([...visibleOrder.map((k) => COLUMN_WIDTHS[k]), ACAO_WIDTH])

  function abrirNovo() {
    setSalvoId(null)
    setEditando(undefined)
    setModalAberto(true)
  }

  function abrirEdicao(orcamento: Orcamento) {
    setSalvoId(null)
    setEditando(orcamento)
    setModalAberto(true)
  }

  function fecharModal() {
    setSalvoId(null)
    setModalAberto(false)
  }

  function converter(orcamento: Orcamento) {
    setErroConversao('')
    setConvertendoId(orcamento.id)
    startTransition(async () => {
      const resultado = await converterEmPedido(orcamento.id)
      setConvertendoId(null)
      if (resultado?.error) setErroConversao(resultado.error)
    })
  }

  function renderCell(key: string, o: Orcamento) {
    switch (key) {
      case 'numero':
        return <div className="col-center text-muted">{o.numero}</div>
      case 'data_orcamento':
        return <div className="col-center text-muted">{formatDateBR(o.data_orcamento)}</div>
      case 'cliente':
        return <div className="col-center text-strong">{o.cliente}</div>
      case 'entidade':
        return <div className="col-center text-muted">{o.entidade}</div>
      case 'data_evento':
        return <div className="col-center text-muted">{o.data_evento ? formatDateBR(o.data_evento) : '-'}</div>
      case 'hora_evento':
        return <div className="col-center text-muted">{o.hora_evento ? o.hora_evento.slice(0, 5) : '-'}</div>
      case 'descricao':
        return <div className="text-muted">{o.descricao ?? '-'}</div>
      case 'numero_pessoas':
        return <div className="col-center text-muted">{o.numero_pessoas ?? '-'}</div>
      case 'valor_total':
        return <div className="col-center">{formatCurrency(o.valor_total)}</div>
      case 'valor_por_pessoa':
        return (
          <div className="col-center text-muted">
            {o.numero_pessoas ? formatCurrency(o.valor_total / o.numero_pessoas) : '-'}
          </div>
        )
      case 'validade':
        return <div className="col-center text-muted">{o.validade ? formatDateBR(o.validade) : '-'}</div>
      case 'status':
        return (
          <div className="col-center">
            {o.excluido_em ? (
              <span className="badge badge-excluido">EXCLUÍDO</span>
            ) : (
              <span className={`badge ${STATUS_BADGE_CLASS[o.status]}`}>{STATUS_LABEL[o.status]}</span>
            )}
          </div>
        )
      default:
        return <div />
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Orçamentos</h1>
        <button type="button" className="btn-primary" onClick={abrirNovo}>
          + Novo orçamento
        </button>
      </div>

      <p className="modal-item-label" style={{ marginBottom: 16 }}>
        Cadastre a proposta enviada ao cliente. Quando ele aceitar, mude o status para <strong>aprovado</strong> e salve:
        o orçamento entra automaticamente na aba Pedidos. Se depois for <strong>recusado</strong>, o pedido é retirado
        (desde que ainda não tenha pagamento nem nota fiscal).
      </p>

      <div className="toolbar" style={{ justifyContent: 'flex-end' }}>
        <ColumnManagerPanel columns={columns} order={order} isVisible={isVisible} onToggleVisible={toggleVisible} onReorder={reorder} />
      </div>

      {erroConversao && (
        <p className="form-error" style={{ marginBottom: 12 }}>
          {erroConversao}
        </p>
      )}

      <div className="data-table table-scroll">
        <div className="table-row table-head" style={{ gridTemplateColumns: gridTemplate, minWidth }}>
          {visibleOrder.map((key) => {
            const col = columnsByKey.get(key)
            return (
              <div key={key} className="col-filter" style={{ justifyContent: key === 'descricao' ? 'flex-start' : 'center' }}>
                <span>{COLUMN_LABELS[key]}</span>
                <ColumnHeaderFilter filter={col?.filter} dateRangeFilter={col?.dateRangeFilter} />
              </div>
            )
          })}
          <div></div>
        </div>

        {orcamentosPaginados.map((o) => (
          <div
            key={o.id}
            className={`table-row${o.excluido_em ? ' row-excluido' : ''}`}
            style={{ gridTemplateColumns: gridTemplate, minWidth }}
            title={o.excluido_em ? `Excluído em ${new Date(o.excluido_em).toLocaleDateString('pt-BR')}` : undefined}
          >
            {visibleOrder.map((key) => cloneElement(renderCell(key, o), { key }))}
            <div className="col-center" style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button type="button" className="action-link" onClick={() => abrirEdicao(o)}>
                editar
              </button>
              {o.excluido_em ? null : o.pedido_id ? (
                <span className="text-muted" style={{ fontSize: 12 }}>
                  na aba Pedidos
                </span>
              ) : o.status === 'aprovado' ? (
                <button type="button" className="action-link primary" disabled={convertendoId === o.id} onClick={() => converter(o)}>
                  {convertendoId === o.id ? 'convertendo...' : 'converter em pedido'}
                </button>
              ) : null}
            </div>
          </div>
        ))}

        {orcamentosFiltrados.length === 0 && <div className="empty-state">Nenhum orçamento encontrado.</div>}
      </div>

      <Pagination
        paginaAtual={paginaAtual}
        totalPaginas={totalPaginas}
        totalItens={orcamentosFiltrados.length}
        itensPorPagina={ITENS_POR_PAGINA}
        onChange={setPaginaAtual}
      />

      {modalAberto && (
        <Modal title={editando ? `Orçamento nº ${editando.numero}` : 'Novo orçamento'} onClose={fecharModal} wide>
          <OrcamentoForm
            key={editando?.id ?? 'novo'}
            orcamento={editando}
            produtos={produtos}
            onClose={fecharModal}
            onSalvo={setSalvoId}
            recemSalvo={!!salvoId && salvoId === editando?.id}
          />
        </Modal>
      )}
    </div>
  )
}
