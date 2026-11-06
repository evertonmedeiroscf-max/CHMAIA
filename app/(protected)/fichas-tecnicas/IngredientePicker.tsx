'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

// Uma opção de ingrediente: item do Estoque ("e:<id>") ou ficha de Base ("f:<id>").
export type OpcaoIngrediente = { chave: string; nome: string; detalhe: string }

function normalizar(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

const MAX_RESULTADOS = 50

// Escolha de um ingrediente pela busca no nome (sem diferenciar acento nem
// maiúscula). Cada opção mostra categoria, unidade e preço (ou "Ficha de Base" e
// o custo/kg) porque pode haver itens com o mesmo nome (ex.: MORTADELA) ou um
// item do Estoque com o nome de uma Base — quem decide qual vale é o usuário,
// nunca o sistema. A lista usa posição "fixed" pra não ser cortada pelo scroll
// horizontal da tabela da ficha.
export default function IngredientePicker({
  opcoes,
  valor,
  onChange,
  invalido = false,
  placeholder = 'Buscar ingrediente…',
}: {
  opcoes: OpcaoIngrediente[]
  valor: string
  onChange: (chave: string) => void
  invalido?: boolean
  placeholder?: string
}) {
  const selecionada = useMemo(() => opcoes.find((o) => o.chave === valor), [opcoes, valor])
  const [busca, setBusca] = useState('')
  const [aberto, setAberto] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const raizRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const resultados = useMemo(() => {
    if (!aberto) return []
    const q = normalizar(busca.trim())
    const lista = q ? opcoes.filter((o) => normalizar(o.nome).includes(q)) : opcoes
    return lista.slice(0, MAX_RESULTADOS)
  }, [aberto, busca, opcoes])

  useEffect(() => {
    if (!aberto) return
    function reposicionar() {
      const r = inputRef.current?.getBoundingClientRect()
      if (r) setPos({ top: r.bottom + 2, left: r.left, width: Math.max(r.width, 360) })
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

  function escolher(opcao: OpcaoIngrediente) {
    onChange(opcao.chave)
    setAberto(false)
    setBusca('')
  }

  return (
    <div className="picker" ref={raizRef}>
      <input
        ref={inputRef}
        type="text"
        className={`picker-input${invalido ? ' picker-invalido' : ''}`}
        placeholder={placeholder}
        value={aberto ? busca : (selecionada?.nome ?? '')}
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
          {resultados.map((opcao) => (
            <li
              key={opcao.chave}
              role="option"
              aria-selected={opcao.chave === valor}
              // mousedown (e não click) pra escolher antes do input perder o foco
              onMouseDown={(e) => {
                e.preventDefault()
                escolher(opcao)
              }}
            >
              <span className="picker-nome">{opcao.nome}</span>
              <span className="picker-detalhe">{opcao.detalhe}</span>
            </li>
          ))}
          {resultados.length === 0 && <li className="picker-vazio">Nenhum ingrediente encontrado</li>}
        </ul>
      )}
    </div>
  )
}
