'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Produto } from '@/lib/types/domain'
import { formatCurrency } from '@/lib/utils/format'

const SEM_CATEGORIA = 'Sem categoria'

function normalizar(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

// Seletor do catálogo no jeito do filtro do Excel: campo "Pesquisar",
// seletor de categoria logo abaixo, "(Selecionar tudo)" sobre o resultado e
// checklist — marca vários produtos e confirma com OK para inserir todos
// de uma vez na seção. A busca olha nome e categoria, ignorando acentos e
// maiúsculas, e se combina com a categoria escolhida. Renderizado
// num portal (como ColumnHeaderFilter) para não ser cortado pelo scroll do
// modal/planilha.
export default function SeletorCatalogo({
  produtos,
  onAdicionar,
}: {
  produtos: Produto[]
  onAdicionar: (selecionados: Produto[]) => void
}) {
  const [aberto, setAberto] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const [busca, setBusca] = useState('')
  const [categoria, setCategoria] = useState('')
  const [marcados, setMarcados] = useState<Set<string>>(new Set())
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const ordenados = useMemo(() => [...produtos].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')), [produtos])
  const categorias = useMemo(() => {
    const contagem = new Map<string, number>()
    produtos.forEach((p) => {
      const c = p.categoria?.trim() || SEM_CATEGORIA
      contagem.set(c, (contagem.get(c) ?? 0) + 1)
    })
    return [...contagem.entries()].sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
  }, [produtos])

  const filtrados = useMemo(() => {
    const termo = normalizar(busca.trim())
    return ordenados.filter(
      (p) =>
        (!categoria || (p.categoria?.trim() || SEM_CATEGORIA) === categoria) &&
        (!termo || normalizar(`${p.nome} ${p.categoria ?? ''}`).includes(termo))
    )
  }, [ordenados, busca, categoria])

  function fechar() {
    setAberto(false)
    setBusca('')
    setCategoria('')
    setMarcados(new Set())
  }

  useEffect(() => {
    if (!aberto) return
    function foraDoMenu(e: MouseEvent) {
      const alvo = e.target as Node
      if (btnRef.current?.contains(alvo) || menuRef.current?.contains(alvo)) return
      fechar()
    }
    function posicionar() {
      const r = btnRef.current?.getBoundingClientRect()
      if (!r) return
      const largura = 380
      const alturaMax = 460
      const left = Math.max(8, Math.min(r.left, window.innerWidth - largura - 8))
      // Abre para cima quando não cabe embaixo (planilha no fim do modal).
      const top = r.bottom + alturaMax > window.innerHeight ? Math.max(8, r.top - alturaMax - 4) : r.bottom + 4
      setPos({ top, left })
    }
    posicionar()
    document.addEventListener('mousedown', foraDoMenu)
    window.addEventListener('scroll', posicionar, true)
    window.addEventListener('resize', posicionar)
    return () => {
      document.removeEventListener('mousedown', foraDoMenu)
      window.removeEventListener('scroll', posicionar, true)
      window.removeEventListener('resize', posicionar)
    }
  }, [aberto])

  const todosFiltradosMarcados = filtrados.length > 0 && filtrados.every((p) => marcados.has(p.id))

  function alternar(id: string) {
    setMarcados((atual) => {
      const novo = new Set(atual)
      if (novo.has(id)) novo.delete(id)
      else novo.add(id)
      return novo
    })
  }

  function alternarTodos() {
    setMarcados((atual) => {
      const novo = new Set(atual)
      filtrados.forEach((p) => (todosFiltradosMarcados ? novo.delete(p.id) : novo.add(p.id)))
      return novo
    })
  }

  function confirmar() {
    // Mantém a ordem alfabética da lista, não a ordem dos cliques.
    onAdicionar(ordenados.filter((p) => marcados.has(p.id)))
    fechar()
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="seletor-catalogo-botao"
        onClick={() => (aberto ? fechar() : setAberto(true))}
      >
        + do catálogo… <span aria-hidden>▾</span>
      </button>
      {aberto &&
        pos &&
        createPortal(
          <div ref={menuRef} className="seletor-catalogo" style={{ top: pos.top, left: pos.left }}>
            <input
              type="text"
              className="col-filter-search"
              placeholder="Pesquisar produto ou categoria"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (marcados.size) confirmar()
                  else if (filtrados.length === 1) {
                    onAdicionar(filtrados)
                    fechar()
                  }
                }
                if (e.key === 'Escape') fechar()
              }}
              autoFocus
            />
            <select
              className="select-control seletor-catalogo-categoria"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              aria-label="Filtrar por categoria"
            >
              <option value="">Todas as categorias ({produtos.length})</option>
              {categorias.map(([c, n]) => (
                <option key={c} value={c}>
                  {c} ({n})
                </option>
              ))}
            </select>
            <div className="seletor-catalogo-lista">
              {filtrados.length > 0 && (
                <label className="seletor-catalogo-opcao seletor-catalogo-todos">
                  <input type="checkbox" checked={todosFiltradosMarcados} onChange={alternarTodos} />
                  <span>{busca || categoria ? '(Selecionar todos os resultados)' : '(Selecionar tudo)'}</span>
                </label>
              )}
              {filtrados.map((p) => (
                <label key={p.id} className="seletor-catalogo-opcao" title={p.observacao ?? undefined}>
                  <input type="checkbox" checked={marcados.has(p.id)} onChange={() => alternar(p.id)} />
                  <span className="seletor-catalogo-nome">
                    {p.nome}
                    {p.categoria && <small>{p.categoria}</small>}
                  </span>
                  <span className="seletor-catalogo-preco">{formatCurrency(p.valor_unit_padrao)}</span>
                </label>
              ))}
              {filtrados.length === 0 && <p className="seletor-catalogo-vazio">Nenhum produto encontrado</p>}
            </div>
            <div className="seletor-catalogo-rodape">
              <span className="text-muted">
                {marcados.size ? `${marcados.size} selecionado${marcados.size > 1 ? 's' : ''}` : `${filtrados.length} produtos`}
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" className="btn-primary" disabled={!marcados.size} onClick={confirmar}>
                  OK
                </button>
                <button type="button" className="btn-secondary" onClick={fechar}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
