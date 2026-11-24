'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { COLUNAS_FICHA, MAX_LEMBRETE, type ChaveColunaFicha, type LembretesFicha } from '@/lib/utils/lembretesFicha'
import { excluirLembreteColuna, salvarLembreteColuna, type ResultadoLembrete } from './actions'

type Acoes = {
  salvar: (coluna: string, texto: string) => Promise<ResultadoLembrete>
  excluir: (coluna: string) => Promise<ResultadoLembrete>
}
const ACOES_REAIS: Acoes = { salvar: salvarLembreteColuna, excluir: excluirLembreteColuna }

type Ponto = { top: number; left: number }
type Menu = { chave: ChaveColunaFicha; x: number; y: number }
type Edicao = { chave: ChaveColunaFicha; pos: Ponto; texto: string }

const LARGURA_NOTA = 280

// Linha vermelha de cabeçalho da tabela de ingredientes da ficha (Ingredientes, Observações, Unid,
// Peso líquido, FC, Peso bruto, Medida caseira, Preço do Kg, Preço unit), com "lembretes": uma
// nota amarela por coluna, como o comentário de célula do Excel.
//  - Coluna com lembrete mostra um triângulo no canto; passar o mouse (ou tocar) mostra a nota.
//    Isso vale para todo usuário que vê a ficha.
//  - Clicar com o BOTÃO DIREITO no cabeçalho abre o menu "Inserir / Editar / Excluir lembrete" —
//    SÓ para o ADM (`ehAdm`). Para os demais usuários o clique direito continua sendo o do navegador.
// `acoes` só existe para a tela poder ser testada sem login; no sistema são sempre as reais (que
// também conferem o ADM no servidor e no banco).
export default function CabecalhoTabelaFicha({
  className,
  lembretes,
  ehAdm,
  extra,
  acoes = ACOES_REAIS,
}: {
  className: string
  lembretes: LembretesFicha
  ehAdm: boolean
  extra?: ReactNode
  acoes?: Acoes
}) {
  const router = useRouter()
  const [locais, setLocais] = useState<LembretesFicha>(lembretes)
  const [nota, setNota] = useState<{ chave: ChaveColunaFicha; pos: Ponto; fixa: boolean } | null>(null)
  const [menu, setMenu] = useState<Menu | null>(null)
  const [edicao, setEdicao] = useState<Edicao | null>(null)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const celulas = useRef<Partial<Record<ChaveColunaFicha, HTMLDivElement | null>>>({})
  const menuRef = useRef<HTMLDivElement>(null)
  const edicaoRef = useRef<HTMLDivElement>(null)

  useEffect(() => setLocais(lembretes), [lembretes])

  const posicaoDaCelula = useCallback((chave: ChaveColunaFicha): Ponto => {
    const r = celulas.current[chave]?.getBoundingClientRect()
    if (!r) return { top: 80, left: 20 }
    return { top: r.bottom + 4, left: Math.max(8, Math.min(r.left, window.innerWidth - LARGURA_NOTA - 12)) }
  }, [])

  // Fecha menu e nota fixada ao clicar fora, e o menu também com Esc ou ao rolar a página.
  useEffect(() => {
    function aoClicarFora(e: MouseEvent) {
      const alvo = e.target as Node
      if (menuRef.current?.contains(alvo)) return
      if (edicaoRef.current?.contains(alvo)) return
      setMenu(null)
      setNota((n) => (n?.fixa ? null : n))
    }
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setMenu(null)
        setNota(null)
      }
    }
    function aoRolar() {
      setMenu(null)
      setNota(null)
    }
    document.addEventListener('mousedown', aoClicarFora)
    document.addEventListener('keydown', aoTeclar)
    window.addEventListener('scroll', aoRolar, true)
    return () => {
      document.removeEventListener('mousedown', aoClicarFora)
      document.removeEventListener('keydown', aoTeclar)
      window.removeEventListener('scroll', aoRolar, true)
    }
  }, [])

  function abrirEdicao(chave: ChaveColunaFicha) {
    setMenu(null)
    setNota(null)
    setErro('')
    setEdicao({ chave, pos: posicaoDaCelula(chave), texto: locais[chave] ?? '' })
  }

  async function salvar() {
    if (!edicao || salvando) return
    setErro('')
    setSalvando(true)
    try {
      const resultado = await acoes.salvar(edicao.chave, edicao.texto)
      if ('error' in resultado) {
        setErro(resultado.error)
        return
      }
      setLocais((atual) => ({ ...atual, [edicao.chave]: edicao.texto.trim() }))
      setEdicao(null)
      router.refresh()
    } catch {
      setErro('Não foi possível salvar o lembrete. Confira a conexão e tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  async function excluir(chave: ChaveColunaFicha) {
    setMenu(null)
    const rotulo = COLUNAS_FICHA.find((c) => c.chave === chave)?.rotulo ?? ''
    if (!window.confirm(`Excluir o lembrete da coluna "${rotulo}"?\n\nEle deixa de aparecer para todos os usuários, em todas as fichas.`)) return
    try {
      const resultado = await acoes.excluir(chave)
      if ('error' in resultado) {
        window.alert(resultado.error)
        return
      }
      setLocais((atual) => {
        const proximo = { ...atual }
        delete proximo[chave]
        return proximo
      })
      router.refresh()
    } catch {
      window.alert('Não foi possível excluir o lembrete. Confira a conexão e tente novamente.')
    }
  }

  const rotuloMenu = menu ? (COLUNAS_FICHA.find((c) => c.chave === menu.chave)?.rotulo ?? '') : ''
  const rotuloEdicao = edicao ? (COLUNAS_FICHA.find((c) => c.chave === edicao.chave)?.rotulo ?? '') : ''
  const textoDaNota = nota && !edicao ? locais[nota.chave] : undefined

  return (
    <>
      <div className={className}>
        {COLUNAS_FICHA.map((c) => {
          const tem = !!locais[c.chave]
          return (
            <div
              key={c.chave}
              ref={(el) => {
                celulas.current[c.chave] = el
              }}
              className={`ficha-cab-celula${tem ? ' tem-lembrete' : ''}`}
              onMouseEnter={tem ? () => setNota((n) => (n?.fixa ? n : { chave: c.chave, pos: posicaoDaCelula(c.chave), fixa: false })) : undefined}
              onMouseLeave={tem ? () => setNota((n) => (n?.fixa ? n : null)) : undefined}
              onClick={tem ? () => setNota((n) => (n?.chave === c.chave && n.fixa ? null : { chave: c.chave, pos: posicaoDaCelula(c.chave), fixa: true })) : undefined}
              onContextMenu={
                ehAdm
                  ? (e) => {
                      e.preventDefault()
                      setNota(null)
                      setMenu({ chave: c.chave, x: e.clientX, y: e.clientY })
                    }
                  : undefined
              }
            >
              {c.rotulo}
            </div>
          )
        })}
        {extra}
      </div>

      {typeof document !== 'undefined' &&
        textoDaNota &&
        nota &&
        createPortal(
          <div className="ficha-lembrete" role="tooltip" style={{ position: 'fixed', top: nota.pos.top, left: nota.pos.left, width: LARGURA_NOTA }}>
            {textoDaNota}
          </div>,
          document.body
        )}

      {typeof document !== 'undefined' &&
        ehAdm &&
        menu &&
        createPortal(
          <div
            ref={menuRef}
            className="ficha-menu-contexto"
            role="menu"
            aria-label={`Lembrete da coluna ${rotuloMenu}`}
            style={{ position: 'fixed', top: Math.min(menu.y, window.innerHeight - 120), left: Math.min(menu.x, window.innerWidth - 200) }}
          >
            {locais[menu.chave] ? (
              <>
                <button type="button" role="menuitem" onClick={() => abrirEdicao(menu.chave)}>
                  Editar lembrete
                </button>
                <button type="button" role="menuitem" onClick={() => void excluir(menu.chave)}>
                  Excluir lembrete
                </button>
              </>
            ) : (
              <button type="button" role="menuitem" onClick={() => abrirEdicao(menu.chave)}>
                Inserir lembrete
              </button>
            )}
          </div>,
          document.body
        )}

      {typeof document !== 'undefined' &&
        ehAdm &&
        edicao &&
        createPortal(
          <div
            ref={edicaoRef}
            className="ficha-lembrete ficha-lembrete-edicao"
            style={{ position: 'fixed', top: edicao.pos.top, left: edicao.pos.left, width: LARGURA_NOTA }}
          >
            <div className="ficha-lembrete-titulo">Lembrete: {rotuloEdicao}</div>
            <textarea
              value={edicao.texto}
              onChange={(e) => setEdicao({ ...edicao, texto: e.target.value })}
              maxLength={MAX_LEMBRETE}
              rows={5}
              autoFocus
              aria-label={`Texto do lembrete da coluna ${rotuloEdicao}`}
            />
            {erro && <p className="ficha-lembrete-erro">{erro}</p>}
            <div className="ficha-lembrete-botoes">
              <button type="button" onClick={() => setEdicao(null)} disabled={salvando}>
                Cancelar
              </button>
              <button type="button" className="principal" onClick={() => void salvar()} disabled={salvando}>
                {salvando ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
