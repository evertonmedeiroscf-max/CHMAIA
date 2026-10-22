'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { ItemEstoqueFicha } from '@/lib/types/domain'
import { formatCurrency } from '@/lib/utils/format'

function normalizar(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

const MAX_RESULTADOS = 50

// Escolha de um item do Estoque pela busca no nome (sem diferenciar acento nem
// maiúscula). Cada opção mostra categoria, unidade e preço corrente porque o
// Estoque pode ter itens com o mesmo nome (ex.: MORTADELA) — quem decide qual
// vale é o usuário, nunca o sistema. A lista usa posição "fixed" pra não ser
// cortada pelo scroll horizontal da tabela da ficha.
export default function EstoqueItemPicker({
  itens,
  valor,
  onChange,
  invalido = false,
}: {
  itens: ItemEstoqueFicha[]
  valor: string
  onChange: (itemId: string) => void
  invalido?: boolean
}) {
  const selecionado = useMemo(() => itens.find((i) => i.id === valor), [itens, valor])
  const [busca, setBusca] = useState('')
  const [aberto, setAberto] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const raizRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const resultados = useMemo(() => {
    if (!aberto) return []
    const q = normalizar(busca.trim())
    const lista = q ? itens.filter((i) => normalizar(i.nome).includes(q)) : itens
    return lista.slice(0, MAX_RESULTADOS)
  }, [aberto, busca, itens])

  useEffect(() => {
    if (!aberto) return
    function reposicionar() {
      const r = inputRef.current?.getBoundingClientRect()
      if (r) setPos({ top: r.bottom + 2, left: r.left, width: Math.max(r.width, 340) })
    }
    function fecharAoClicarFora(e: MouseEvent) {
      if (!raizRef.current?.contains(e.target as Node)) setAberto(false)
    }
    reposicionar()
    window.addEventListener('scroll', reposicionar, true)
    window.addEventListener('resize', reposicionar)
    document.addEventListener('mousedown', fecharAoClicarFora)
    return () => {
      window.removeEventListener('scroll', reposicionar, true)
      window.removeEventListener('resize', reposicionar)
      document.removeEventListener('mousedown', fecharAoClicarFora)
    }
  }, [aberto])

  function escolher(item: ItemEstoqueFicha) {
    onChange(item.id)
    setAberto(false)
    setBusca('')
  }

  return (
    <div className="picker" ref={raizRef}>
      <input
        ref={inputRef}
        type="text"
        className={`picker-input${invalido ? ' picker-invalido' : ''}`}
        placeholder="Buscar ingrediente no Estoque…"
        value={aberto ? busca : (selecionado?.nome ?? '')}
        onFocus={() => {
          setBusca('')
          setAberto(true)
        }}
        onChange={(e) => {
          setBusca(e.target.value)
          setAberto(true)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setAberto(false)
            inputRef.current?.blur()
          }
          if (e.key === 'Enter') {
            // Enter escolhe o primeiro resultado em vez de enviar o formulário.
            e.preventDefault()
            if (resultados[0]) escolher(resultados[0])
          }
        }}
        autoComplete="off"
        aria-label="Ingrediente"
      />
      {aberto && pos && (
        <ul className="picker-lista" style={{ top: pos.top, left: pos.left, width: pos.width }} role="listbox">
          {resultados.map((item) => (
            <li
              key={item.id}
              role="option"
              aria-selected={item.id === valor}
              // mousedown (e não click) pra escolher antes do input perder o foco
              onMouseDown={(e) => {
                e.preventDefault()
                escolher(item)
              }}
            >
              <span className="picker-nome">{item.nome}</span>
              <span className="picker-detalhe">
                {item.categoria} · {item.unidade_medida} ·{' '}
                {item.preco_corrente !== null ? formatCurrency(item.preco_corrente) : 'sem preço'}
              </span>
            </li>
          ))}
          {resultados.length === 0 && <li className="picker-vazio">Nenhum item do Estoque encontrado</li>}
        </ul>
      )}
    </div>
  )
}
