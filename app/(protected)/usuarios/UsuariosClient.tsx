'use client'

import { useEffect, useMemo, useState } from 'react'
import Pagination from '@/components/Pagination'
import { PAGINAS_SISTEMA, type TipoUsuario, type Usuario } from '@/lib/types/domain'
import { formatDateBR } from '@/lib/utils/format'
import { definirAprovacao, definirPaginas, definirTipo } from './actions'

const USUARIOS_GRID = '1fr 130px 130px 190px 120px 120px'
const ITENS_POR_PAGINA = 15

export default function UsuariosClient({
  usuarios,
  currentUserId,
}: {
  usuarios: Usuario[]
  currentUserId: string
}) {
  const [filtro, setFiltro] = useState<'todos' | 'pendentes' | 'aprovados'>('todos')
  const [paginaAtual, setPaginaAtual] = useState(1)

  const usuariosFiltrados = useMemo(() => {
    return usuarios.filter((u) => {
      if (filtro === 'pendentes') return !u.aprovado
      if (filtro === 'aprovados') return u.aprovado
      return true
    })
  }, [usuarios, filtro])

  useEffect(() => {
    setPaginaAtual(1)
  }, [usuariosFiltrados])

  const totalPaginas = Math.max(1, Math.ceil(usuariosFiltrados.length / ITENS_POR_PAGINA))
  const usuariosPaginados = useMemo(
    () => usuariosFiltrados.slice((paginaAtual - 1) * ITENS_POR_PAGINA, paginaAtual * ITENS_POR_PAGINA),
    [usuariosFiltrados, paginaAtual]
  )

  async function alternarAprovacao(usuario: Usuario) {
    await definirAprovacao(usuario.id, !usuario.aprovado)
  }

  async function handleChangeTipo(usuario: Usuario, tipo: TipoUsuario) {
    if (tipo === usuario.tipo) return
    await definirTipo(usuario.id, tipo)
  }

  async function alternarPagina(usuario: Usuario, chave: string) {
    const paginas = usuario.paginas.includes(chave)
      ? usuario.paginas.filter((p) => p !== chave)
      : [...usuario.paginas, chave]
    await definirPaginas(usuario.id, paginas)
  }

  return (
    <div>
      <div className="page-header">
        <h1>Usuários</h1>
      </div>

      <p className="modal-item-label" style={{ marginBottom: 16 }}>
        Todo cadastro novo entra como <strong>pendente</strong> e só ganha acesso ao sistema depois que um{' '}
        <strong>ADM</strong> liberar aqui. Só ADM aprova cadastros, define quem mais é ADM e escolhe quais abas cada
        usuário vê.
      </p>

      <div className="toolbar">
        <select className="select-control" value={filtro} onChange={(e) => setFiltro(e.target.value as typeof filtro)}>
          <option value="todos">Todos</option>
          <option value="pendentes">Pendentes</option>
          <option value="aprovados">Aprovados</option>
        </select>
      </div>

      <div className="data-table">
        <div className="table-row table-head" style={{ gridTemplateColumns: USUARIOS_GRID }}>
          <div>E-MAIL</div>
          <div className="col-center">STATUS</div>
          <div className="col-center">TIPO</div>
          <div className="col-center">ACESSO ÀS ABAS</div>
          <div className="col-center">CADASTRO</div>
          <div className="col-center">AÇÃO</div>
        </div>
        {usuariosPaginados.map((u) => {
          const isSelf = u.id === currentUserId
          return (
            <div key={u.id} className="table-row" style={{ gridTemplateColumns: USUARIOS_GRID }}>
              <div className="text-strong">
                {u.email}
                {isSelf && <span className="text-muted"> (você)</span>}
              </div>
              <div className="col-center">
                <span className={`badge ${u.aprovado ? 'badge-pago' : 'badge-pendente'}`}>
                  {u.aprovado ? 'APROVADO' : 'PENDENTE'}
                </span>
              </div>
              <div className="col-center">
                {isSelf ? (
                  <span className="text-muted">{u.tipo === 'adm' ? 'ADM' : 'Usuário'}</span>
                ) : (
                  <select
                    className="select-control"
                    style={{ width: '100%' }}
                    value={u.tipo}
                    onChange={(e) => handleChangeTipo(u, e.target.value as TipoUsuario)}
                  >
                    <option value="usuario">Usuário</option>
                    <option value="adm">ADM</option>
                  </select>
                )}
              </div>
              <div className="col-center">
                {u.tipo === 'adm' ? (
                  <span className="text-muted">Tudo (ADM)</span>
                ) : (
                  <details className="column-manager-filter" style={{ margin: 0, textAlign: 'left' }}>
                    <summary>
                      {u.paginas.length} de {PAGINAS_SISTEMA.length} abas
                    </summary>
                    <div className="column-manager-filter-options">
                      {PAGINAS_SISTEMA.map((p) => (
                        <label key={p.key} className="col-filter-option">
                          <input
                            type="checkbox"
                            checked={u.paginas.includes(p.key)}
                            onChange={() => alternarPagina(u, p.key)}
                          />
                          {p.label}
                        </label>
                      ))}
                    </div>
                  </details>
                )}
              </div>
              <div className="col-center text-muted">{formatDateBR(u.created_at.slice(0, 10))}</div>
              <div className="col-center">
                {isSelf ? (
                  <span className="text-muted">-</span>
                ) : u.aprovado ? (
                  <button type="button" className="action-link" onClick={() => alternarAprovacao(u)}>
                    revogar
                  </button>
                ) : (
                  <button type="button" className="action-link primary" onClick={() => alternarAprovacao(u)}>
                    aprovar
                  </button>
                )}
              </div>
            </div>
          )
        })}
        {usuariosFiltrados.length === 0 && <div className="empty-state">Nenhum usuário encontrado.</div>}
      </div>

      <Pagination
        paginaAtual={paginaAtual}
        totalPaginas={totalPaginas}
        totalItens={usuariosFiltrados.length}
        itensPorPagina={ITENS_POR_PAGINA}
        onChange={setPaginaAtual}
      />
    </div>
  )
}
