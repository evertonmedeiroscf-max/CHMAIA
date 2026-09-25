'use client'

import { useEffect, useMemo, useState } from 'react'
import DateRangePicker from '@/components/DateRangePicker'
import Pagination from '@/components/Pagination'
import type { HistoricoAlteracao } from '@/lib/types/domain'
import { formatDateBR } from '@/lib/utils/format'

const ITENS_POR_PAGINA = 15

const TABELA_LABEL: Record<string, string> = {
  pedidos: 'Pedido',
  despesas: 'Despesa',
  orcamentos: 'Orçamento',
  produtos: 'Produto',
  notas_fiscais: 'Nota fiscal',
  estoque_itens: 'Item de estoque',
  estoque_movimentos: 'Movimento de estoque',
  usuarios: 'Usuário',
}

const CAMPO_PRINCIPAL: Record<string, string> = {
  pedidos: 'cliente',
  despesas: 'descricao',
  orcamentos: 'cliente',
  produtos: 'nome',
  notas_fiscais: 'numero_nota',
  estoque_itens: 'nome',
  estoque_movimentos: 'motivo',
  usuarios: 'email',
}

const OPERACAO_LABEL: Record<string, string> = {
  insert: 'Criou',
  update: 'Alterou',
  delete: 'Excluiu',
}

const OPERACAO_BADGE: Record<string, string> = {
  insert: 'badge-pago',
  update: 'badge-50pago',
  delete: 'badge-pendente',
}

// Campos que existem em toda tabela mas não interessam pra auditoria (ou
// sempre mudam, como updated_at, ou nunca mudam, como id/created_by).
const CAMPOS_IGNORADOS = new Set(['id', 'created_at', 'updated_at', 'created_by'])

function formatValor(v: unknown): string {
  if (v === null || v === undefined || v === '') return '-'
  if (typeof v === 'boolean') return v ? 'Sim' : 'Não'
  if (Array.isArray(v)) return v.length ? v.join(', ') : '-'
  return String(v)
}

function calcularDiff(
  antigos: Record<string, unknown> | null,
  novos: Record<string, unknown> | null
): { campo: string; de: unknown; para: unknown }[] {
  const chaves = new Set([...Object.keys(antigos ?? {}), ...Object.keys(novos ?? {})])
  const diffs: { campo: string; de: unknown; para: unknown }[] = []
  chaves.forEach((campo) => {
    if (CAMPOS_IGNORADOS.has(campo)) return
    const de = antigos ? antigos[campo] : undefined
    const para = novos ? novos[campo] : undefined
    if (JSON.stringify(de) !== JSON.stringify(para)) diffs.push({ campo, de, para })
  })
  return diffs
}

function resumoRegistro(h: HistoricoAlteracao): string {
  const dados = h.dados_novos ?? h.dados_antigos
  const campo = CAMPO_PRINCIPAL[h.tabela]
  const valor = campo && dados ? dados[campo] : null
  return valor ? String(valor) : ''
}

export default function HistoricoClient({ historico }: { historico: HistoricoAlteracao[] }) {
  const [filtroDataInicio, setFiltroDataInicio] = useState('')
  const [filtroDataFim, setFiltroDataFim] = useState('')
  const [filtroUsuario, setFiltroUsuario] = useState('')
  const [filtroTabela, setFiltroTabela] = useState('')
  const [filtroOperacao, setFiltroOperacao] = useState('')
  const [paginaAtual, setPaginaAtual] = useState(1)

  const opcoesUsuario = useMemo(
    () => Array.from(new Set(historico.map((h) => h.usuario_email).filter((v): v is string => !!v))).sort(),
    [historico]
  )
  const opcoesTabela = useMemo(() => Array.from(new Set(historico.map((h) => h.tabela))).sort(), [historico])

  const historicoFiltrado = useMemo(() => {
    return historico.filter((h) => {
      const data = h.criado_em.slice(0, 10)
      if (filtroDataInicio && data < filtroDataInicio) return false
      if (filtroDataFim && data > filtroDataFim) return false
      if (filtroUsuario && h.usuario_email !== filtroUsuario) return false
      if (filtroTabela && h.tabela !== filtroTabela) return false
      if (filtroOperacao && h.operacao !== filtroOperacao) return false
      return true
    })
  }, [historico, filtroDataInicio, filtroDataFim, filtroUsuario, filtroTabela, filtroOperacao])

  useEffect(() => {
    setPaginaAtual(1)
  }, [historicoFiltrado])

  const totalPaginas = Math.max(1, Math.ceil(historicoFiltrado.length / ITENS_POR_PAGINA))
  const historicoPaginado = useMemo(
    () => historicoFiltrado.slice((paginaAtual - 1) * ITENS_POR_PAGINA, paginaAtual * ITENS_POR_PAGINA),
    [historicoFiltrado, paginaAtual]
  )

  return (
    <div>
      <div className="page-header">
        <h1>Histórico de alterações</h1>
      </div>

      <p className="modal-item-label" style={{ marginBottom: 16 }}>
        Toda criação, edição ou exclusão feita por um usuário em qualquer aba fica registrada aqui automaticamente,
        com data, hora e o que foi modificado.
      </p>

      <div className="toolbar">
        <DateRangePicker
          from={filtroDataInicio}
          to={filtroDataFim}
          onChange={(de, ate) => {
            setFiltroDataInicio(de)
            setFiltroDataFim(ate)
          }}
        />
        <select className="select-control" value={filtroUsuario} onChange={(e) => setFiltroUsuario(e.target.value)}>
          <option value="">Todos os usuários</option>
          {opcoesUsuario.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
        <select className="select-control" value={filtroTabela} onChange={(e) => setFiltroTabela(e.target.value)}>
          <option value="">Todas as abas</option>
          {opcoesTabela.map((t) => (
            <option key={t} value={t}>
              {TABELA_LABEL[t] ?? t}
            </option>
          ))}
        </select>
        <select className="select-control" value={filtroOperacao} onChange={(e) => setFiltroOperacao(e.target.value)}>
          <option value="">Todas as ações</option>
          <option value="insert">Criações</option>
          <option value="update">Alterações</option>
          <option value="delete">Exclusões</option>
        </select>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {historicoPaginado.map((h) => {
          const diffs = h.operacao === 'update' ? calcularDiff(h.dados_antigos, h.dados_novos) : []
          const resumo = resumoRegistro(h)
          return (
            <div key={h.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, background: 'var(--surface)' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                <span className="text-muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                  {formatDateBR(h.criado_em.slice(0, 10))} às {h.criado_em.slice(11, 16)}
                </span>
                <span className="text-strong">{h.usuario_email ?? 'Sistema'}</span>
                <span className={`badge ${OPERACAO_BADGE[h.operacao]}`}>{OPERACAO_LABEL[h.operacao]}</span>
                <span className="text-muted">{TABELA_LABEL[h.tabela] ?? h.tabela}</span>
                {!!resumo && <span className="text-muted">— {resumo}</span>}
              </div>

              {h.operacao === 'update' &&
                (diffs.length ? (
                  <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 13 }}>
                    {diffs.map((d) => (
                      <li key={d.campo}>
                        <strong>{d.campo}</strong>: {formatValor(d.de)} → {formatValor(d.para)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted" style={{ fontSize: 12, margin: '8px 0 0' }}>
                    Nenhum campo relevante mudou.
                  </p>
                ))}
            </div>
          )
        })}

        {historicoFiltrado.length === 0 && <div className="empty-state">Nenhuma alteração encontrada.</div>}
      </div>

      <Pagination
        paginaAtual={paginaAtual}
        totalPaginas={totalPaginas}
        totalItens={historicoFiltrado.length}
        itensPorPagina={ITENS_POR_PAGINA}
        onChange={setPaginaAtual}
      />
    </div>
  )
}
