'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { FichaTecnica } from '@/lib/types/domain'
import type { FotoFicha } from '@/lib/utils/fichaFotos'
import { montarFolhaImpressao } from './impressao'
import type { LinhaVisual } from './visual'

// Menor tamanho aceito ao reduzir a ficha para caber em uma folha. Abaixo disso a letra fica ilegível.
const ESCALA_MINIMA = 0.3
// Menor largura (em %) a que a grade de fotos do passo a passo pode ser reduzida, só se a letra já
// estiver no mínimo e mesmo assim não couber.
const LARGURA_MINIMA_FOTOS = 40
// A folha é A4 (297 mm) com 8 mm de margem em cima e embaixo; sobra 1 mm de folga contra um arredondamento
// do navegador criar uma segunda folha em branco. Espelha .ficha-impressao no globals.css.
const ALTURA_UTIL_MM = 296 - 16
// Quanto esperar as fotos carregarem antes de imprimir.
const ESPERA_FOTOS_MS = 10_000

// Reduz a letra da folha (variável --escala) até o conteúdo caber em UMA folha A4. Folha curta fica no
// tamanho normal; só encolhe quando precisa. As fotos têm tamanho próprio (ocupam a largura da folha),
// então entram na conta; só se a letra já estiver no mínimo é que a grade de fotos também encolhe.
// Devolve a escala usada e se coube.
export function ajustarAUmaFolha(folha: HTMLElement): { escala: number; coube: boolean } {
  const conteudo = folha.querySelector<HTMLElement>('.ficha-impressao-conteudo')
  if (!conteudo) return { escala: 1, coube: true }

  // Mede fora da tela (a folha fica escondida na tela normal).
  folha.classList.add('ficha-impressao-medindo')
  const sonda = document.createElement('div')
  sonda.style.cssText = `position:fixed;left:-10000px;top:0;width:1px;height:${ALTURA_UTIL_MM}mm`
  document.body.appendChild(sonda)
  const alturaMaxima = sonda.getBoundingClientRect().height
  sonda.remove()

  const grade = folha.querySelector<HTMLElement>('.fi-fotos')
  if (grade) grade.style.width = '100%'

  let escala = 1
  folha.style.setProperty('--escala', '1')
  while (conteudo.scrollHeight > alturaMaxima && escala > ESCALA_MINIMA) {
    escala = Math.round((escala - 0.02) * 100) / 100
    folha.style.setProperty('--escala', String(escala))
  }
  if (grade) {
    let largura = 100
    while (conteudo.scrollHeight > alturaMaxima && largura > LARGURA_MINIMA_FOTOS) {
      largura -= 5
      grade.style.width = `${largura}%`
    }
  }
  const coube = conteudo.scrollHeight <= alturaMaxima
  folha.classList.remove('ficha-impressao-medindo')
  return { escala, coube }
}

// Espera as fotos da folha carregarem (a folha fica escondida; o navegador só garante a imagem pronta
// se a gente esperar). Devolve false se alguma falhou (link vencido, sem internet...).
export async function aguardarFotos(folha: HTMLElement): Promise<boolean> {
  const imagens = Array.from(folha.querySelectorAll<HTMLImageElement>('img'))
  const carregar = (img: HTMLImageElement) => img.decode().then(() => true, () => false)
  const todas = Promise.all(imagens.map(carregar)).then((r) => r.every(Boolean))
  const limite = new Promise<boolean>((resolver) => setTimeout(() => resolver(false), ESPERA_FOTOS_MS))
  return Promise.race([todas, limite])
}

// Botão "Imprimir" da ficha: gera a versão resumida (uma folha A4) com os dados da própria ficha e as
// fotos (produto finalizado em cima, passo a passo embaixo). A folha fica escondida na tela e só aparece
// na impressão; a classe no <body> faz o resto da página sumir só enquanto imprime (ver "Impressão
// resumida da ficha técnica" no globals.css).
export default function BotaoImprimir({ ficha, linhas, fotos = [] }: { ficha: FichaTecnica; linhas: LinhaVisual[]; fotos?: FotoFicha[] }) {
  const folhaRef = useRef<HTMLDivElement>(null)
  const [montado, setMontado] = useState(false)
  const [preparando, setPreparando] = useState(false)
  const folha = useMemo(() => montarFolhaImpressao(ficha, linhas, fotos), [ficha, linhas, fotos])
  const temFotosProduto = folha.fotosProduto.length > 0

  // A folha vai direto para o <body> (portal) para a impressão poder esconder o resto da tela.
  useEffect(() => setMontado(true), [])

  async function imprimir() {
    const el = folhaRef.current
    if (!el || preparando) return
    setPreparando(true)
    try {
      if (!(await aguardarFotos(el))) {
        window.alert('Não foi possível carregar uma das fotos da ficha. Recarregue a página e tente imprimir de novo.')
        return
      }
      const { coube } = ajustarAUmaFolha(el)
      if (!coube) {
        window.alert('Esta ficha é muito grande para caber em uma folha com letra legível. Ela será impressa o menor possível, mas pode ficar cortada.')
      }
      document.body.classList.add('imprimindo-ficha')
      window.addEventListener('afterprint', () => document.body.classList.remove('imprimindo-ficha'), { once: true })
      window.print()
    } finally {
      setPreparando(false)
    }
  }

  const logo = (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/logo-chef-hilana-maia.png" alt="" />
  )
  const linhasResumo = (
    <>
      <div className="fi-linha">
        <span>Última Atualização</span>
        <span>{folha.atualizacao}</span>
      </div>
      <div className="fi-linha">
        <span>{folha.resumo.rotulo}</span>
        <span>{folha.resumo.valor}</span>
      </div>
    </>
  )

  return (
    <>
      <button type="button" className="btn-secondary" onClick={() => void imprimir()} disabled={preparando}>
        {preparando ? 'Preparando…' : 'Imprimir'}
      </button>

      {montado &&
        createPortal(
          <div ref={folhaRef} className="ficha-impressao" aria-hidden="true">
            <div className="ficha-impressao-conteudo">
              <div className={`fi-topo${temFotosProduto ? ' fi-topo-fotos' : ''}`}>
                {temFotosProduto ? (
                  <div className="fi-fotos-produto">
                    {folha.fotosProduto.map((f, i) => (
                      <div key={i} className="fi-foto-produto">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={f.url} alt="" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="fi-logo">{logo}</div>
                )}
                <div className="fi-info">
                  <div className="fi-titulo">{folha.titulo}</div>
                  <div className="fi-nome">{folha.nome}</div>
                  {temFotosProduto ? (
                    <div className="fi-info-baixo">
                      <div className="fi-linhas">{linhasResumo}</div>
                      <div className="fi-logo-mini">{logo}</div>
                    </div>
                  ) : (
                    linhasResumo
                  )}
                </div>
              </div>

              <table className="fi-tabela">
                <colgroup>
                  <col style={{ width: '45%' }} />
                  <col style={{ width: '17%' }} />
                  <col style={{ width: '9%' }} />
                  <col style={{ width: '29%' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>Ingredientes</th>
                    <th>Peso líquido</th>
                    <th>Unid</th>
                    <th>Observação</th>
                  </tr>
                </thead>
                <tbody>
                  {folha.linhas.map((l, i) => (
                    <tr key={i}>
                      <td className={l.semOrigem ? 'fi-sem-origem' : undefined}>
                        {l.nome}
                        {l.referencias.map((r, j) => (
                          <div key={j} className="fi-referencia">
                            {r}
                          </div>
                        ))}
                      </td>
                      <td className="fi-centro">{l.peso}</td>
                      <td className="fi-centro">{l.unidade}</td>
                      <td>{l.observacao}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="fi-faixa">MODO DE PREPARO:</div>
              <div className="fi-modo">{folha.modoPreparo}</div>

              {folha.fotosPasso.length > 0 && (
                <div className="fi-fotos" style={{ gridTemplateColumns: `repeat(${folha.colunasFotos}, 1fr)` }}>
                  {folha.fotosPasso.map((f, i) => (
                    <div key={i} className="fi-foto">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={f.url} alt="" />
                      {f.legenda && <span className="fi-legenda">{f.legenda}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
