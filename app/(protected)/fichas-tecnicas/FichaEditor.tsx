'use client'

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { TIPO_FICHA_LABEL, type FichaTecnica, type FichaTecnicaIngrediente, type ItemEstoqueFicha, type TipoFicha } from '@/lib/types/domain'
import { formatCurrency } from '@/lib/utils/format'
import { calcularFicha, formatNumero, pesoBruto, precoUnitario, type LinhaCalculo } from '@/lib/utils/fichaTecnica'
import { MAX_INGREDIENTES_FICHA } from '@/lib/validations/fichaTecnica'
import FichaCabecalho from './FichaCabecalho'
import { TEXTO_SEM_ORIGEM } from './visual'
import IngredientePicker, { type OpcaoIngrediente } from './IngredientePicker'
import { excluirFichaTecnica, salvarFichaTecnica } from './actions'

// Ficha de Base que pode ser usada como ingrediente (o custo é o custo/kg dela).
export type BaseOpcao = { id: string; nome: string; custoKg: number | null; incompleta: boolean }

type LinhaForm = {
  chave: number
  id: string | null
  // "e:<id do item do Estoque>" | "f:<id da ficha de Base>" | "" (nenhum)
  alvo: string
  // A importação não conseguiu associar este ingrediente (continua assim até escolher um).
  semOrigem: boolean
  origem: string | null
  motivo: string | null
  // Peso que veio vazio do arquivo de origem (não exigir peso só por isso).
  pesoOriginalNulo: boolean
  observacao: string
  peso: string
  fc: string
  medida: string
}

const LINHAS_INICIAIS_FICHA_NOVA = 3

function numeroOuNulo(texto: string): number | null {
  if (texto.trim() === '') return null
  const n = Number(texto.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

// Linha totalmente em branco (só o FC padrão "1"): é ignorada ao salvar, como as
// linhas vazias da planilha. Linha "sem origem" nunca é considerada vazia.
function linhaVazia(l: LinhaForm) {
  return !l.alvo && !l.semOrigem && !l.observacao.trim() && !l.peso.trim() && !l.medida.trim()
}

function novaLinha(chave: number): LinhaForm {
  return { chave, id: null, alvo: '', semOrigem: false, origem: null, motivo: null, pesoOriginalNulo: false, observacao: '', peso: '', fc: '1', medida: '' }
}

export default function FichaEditor({
  ficha,
  tipoNovo,
  ingredientes,
  itens,
  bases,
}: {
  ficha?: FichaTecnica
  tipoNovo?: TipoFicha
  ingredientes: FichaTecnicaIngrediente[]
  itens: ItemEstoqueFicha[]
  bases: BaseOpcao[]
}) {
  const router = useRouter()
  const tipo: TipoFicha = ficha?.tipo ?? tipoNovo ?? 'bases'
  const ehBase = tipo === 'bases'
  const proximaChave = useRef(0)
  const novaChave = () => ++proximaChave.current

  const [nome, setNome] = useState(ficha?.nome ?? '')
  const [rendimento, setRendimento] = useState(ficha?.rendimento_kg != null ? String(ficha.rendimento_kg) : '')
  const [markup, setMarkup] = useState(ficha?.markup != null ? String(ficha.markup) : '')
  const [serve, setServe] = useState(ficha?.serve != null ? String(ficha.serve) : '')
  const [dataAtualizacao, setDataAtualizacao] = useState(ficha?.data_atualizacao ?? '')
  const [modoPreparo, setModoPreparo] = useState(ficha?.modo_preparo ?? '')
  const [linhas, setLinhas] = useState<LinhaForm[]>(() =>
    ficha
      ? ingredientes.map((i) => ({
          chave: novaChave(),
          id: i.id,
          alvo: i.estoque_item_id ? `e:${i.estoque_item_id}` : i.ficha_ingrediente_id ? `f:${i.ficha_ingrediente_id}` : '',
          semOrigem: i.sem_origem,
          origem: i.ingrediente_origem,
          motivo: i.sem_origem_motivo,
          pesoOriginalNulo: i.peso_liquido === null,
          observacao: i.observacao ?? '',
          peso: i.peso_liquido !== null ? String(i.peso_liquido) : '',
          fc: i.fc !== null ? String(i.fc) : '',
          medida: i.medida_caseira ?? '',
        }))
      : Array.from({ length: LINHAS_INICIAIS_FICHA_NOVA }, () => novaLinha(novaChave()))
  )
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const enviandoRef = useRef(false)

  // Opções do seletor: itens do Estoque + fichas de Base (menos a própria ficha).
  const { opcoes, infoPorChave } = useMemo(() => {
    const lista: OpcaoIngrediente[] = []
    const info = new Map<string, { unidade: string; preco: number | null; parcial: boolean }>()
    for (const i of itens) {
      const chave = `e:${i.id}`
      lista.push({
        chave,
        nome: i.nome,
        detalhe: `${i.categoria} · ${i.unidade_medida} · ${i.preco_corrente !== null ? formatCurrency(i.preco_corrente) : 'sem preço'}`,
      })
      info.set(chave, { unidade: i.unidade_medida, preco: i.preco_corrente, parcial: false })
    }
    for (const b of bases) {
      if (b.id === ficha?.id) continue
      const chave = `f:${b.id}`
      lista.push({ chave, nome: b.nome, detalhe: `Ficha de Base · custo/kg ${b.custoKg !== null ? formatCurrency(b.custoKg) : 'indisponível'}` })
      info.set(chave, { unidade: 'KG', preco: b.custoKg, parcial: b.incompleta })
    }
    return { opcoes: lista, infoPorChave: info }
  }, [itens, bases, ficha?.id])

  const calculadas = linhas.map((l) => {
    const info = l.alvo ? infoPorChave.get(l.alvo) : undefined
    const base: LinhaCalculo = { peso_liquido: numeroOuNulo(l.peso), fc: numeroOuNulo(l.fc), preco_kg: info?.preco ?? null, parcial: info?.parcial }
    return { info, base, bruto: pesoBruto(base), unit: info ? precoUnitario(base) : null }
  })
  const resumo = calcularFicha(
    linhas.flatMap((l, i) => (linhaVazia(l) ? [] : [calculadas[i].base])),
    { rendimentoKg: numeroOuNulo(rendimento), markup: numeroOuNulo(markup), serve: numeroOuNulo(serve) }
  )

  function atualizar(chave: number, campos: Partial<LinhaForm>) {
    setLinhas((atuais) => atuais.map((l) => (l.chave === chave ? { ...l, ...campos } : l)))
  }

  function adicionarLinha() {
    setLinhas((atuais) => (atuais.length >= MAX_INGREDIENTES_FICHA ? atuais : [...atuais, novaLinha(novaChave())]))
  }

  function removerLinha(chave: number) {
    setLinhas((atuais) => atuais.filter((l) => l.chave !== chave))
  }

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault()
    if (enviandoRef.current) return
    setErro('')

    const preenchidas = linhas.filter((l) => !linhaVazia(l))
    if (preenchidas.some((l) => !l.alvo && !l.semOrigem)) {
      setErro('Escolha o ingrediente em todas as linhas preenchidas (ou apague as linhas em branco).')
      return
    }
    const semPeso = preenchidas.find((l) => l.alvo && l.peso.trim() === '' && !l.pesoOriginalNulo)
    if (semPeso) {
      setErro(`Informe o peso líquido de ${opcoes.find((o) => o.chave === semPeso.alvo)?.nome ?? 'todos os ingredientes'}.`)
      return
    }

    enviandoRef.current = true
    setSalvando(true)
    try {
      const resultado = await salvarFichaTecnica(ficha?.id ?? null, {
        tipo,
        nome,
        rendimento_kg: ehBase ? rendimento : null,
        markup: ehBase ? null : markup,
        serve: ehBase ? null : serve,
        data_atualizacao: dataAtualizacao || null,
        modo_preparo: modoPreparo || null,
        ingredientes: preenchidas.map((l) => ({
          id: l.id,
          estoque_item_id: l.alvo.startsWith('e:') ? l.alvo.slice(2) : null,
          ficha_ingrediente_id: l.alvo.startsWith('f:') ? l.alvo.slice(2) : null,
          ingrediente_origem: l.origem,
          sem_origem: !l.alvo && l.semOrigem,
          sem_origem_motivo: l.motivo,
          observacao: l.observacao,
          peso_liquido: l.peso,
          fc: l.fc,
          medida_caseira: l.medida,
        })),
      })
      if ('error' in resultado) {
        setErro(resultado.error)
        return
      }
      // Depois de salvar, fica na própria ficha (visualização), não volta pro índice.
      router.push(`/fichas-tecnicas/${resultado.id}`)
      router.refresh()
    } catch {
      setErro('Não foi possível salvar a ficha. Confira a conexão e tente novamente.')
    } finally {
      enviandoRef.current = false
      setSalvando(false)
    }
  }

  async function handleExcluir() {
    if (!ficha || enviandoRef.current) return
    if (!window.confirm(`Excluir a ficha técnica "${ficha.nome}"?\n\nEsta ação não pode ser desfeita.`)) return
    enviandoRef.current = true
    setSalvando(true)
    setErro('')
    try {
      const resultado = await excluirFichaTecnica(ficha.id)
      if ('error' in resultado) {
        setErro(resultado.error)
        return
      }
      router.push('/fichas-tecnicas')
      router.refresh()
    } catch {
      setErro('Não foi possível excluir a ficha. Tente novamente.')
    } finally {
      enviandoRef.current = false
      setSalvando(false)
    }
  }

  const voltarPara = ficha ? `/fichas-tecnicas/${ficha.id}` : '/fichas-tecnicas'

  return (
    <div>
      <div className="page-header">
        <h1>{ficha ? 'Editar ficha técnica' : `Nova ${TIPO_FICHA_LABEL[tipo].toLowerCase()}`}</h1>
        <Link href={voltarPara} className="btn-secondary">
          ← Voltar
        </Link>
      </div>

      <form className="ficha" onSubmit={handleSalvar}>
        <FichaCabecalho
          tipo={tipo}
          nome={
            <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="NOME DA RECEITA" aria-label="Nome da receita" required />
          }
        />

        <div className="ficha-resumo">
          <div className="ficha-resumo-linha">
            <span className="ficha-data-rotulo">DATA ATUALIZAÇÃO:</span>
            <input type="date" value={dataAtualizacao} onChange={(e) => setDataAtualizacao(e.target.value)} aria-label="Data de atualização" />
          </div>
          {ehBase ? (
            <>
              <div className="ficha-resumo-linha">
                <span>Rendimento total da receita</span>
                <span className="ficha-resumo-valor">
                  <input type="number" step="any" min="0" value={rendimento} onChange={(e) => setRendimento(e.target.value)} aria-label="Rendimento total em kg" required />{' '}
                  Kg
                </span>
              </div>
              <div className="ficha-resumo-linha">
                <span>Custo total da receita</span>
                <span className="ficha-resumo-valor">{formatCurrency(resumo.custoTotal)}</span>
              </div>
              <div className="ficha-resumo-linha">
                <span>Custo do kg</span>
                <span className="ficha-resumo-valor">{resumo.custoKg !== null ? formatCurrency(resumo.custoKg) : '-'}</span>
              </div>
            </>
          ) : (
            <>
              <div className="ficha-resumo-linha">
                <span>Custo do prato</span>
                <span className="ficha-resumo-valor">{formatCurrency(resumo.custoTotal)}</span>
              </div>
              <div className="ficha-resumo-linha">
                <span>Markup</span>
                <span className="ficha-resumo-valor">
                  <input type="number" step="any" min="0" value={markup} onChange={(e) => setMarkup(e.target.value)} aria-label="Markup" />
                </span>
              </div>
              <div className="ficha-resumo-linha">
                <span>Preço sugerido</span>
                <span className="ficha-resumo-valor">{resumo.precoSugerido !== null ? formatCurrency(resumo.precoSugerido) : '-'}</span>
              </div>
              <div className="ficha-resumo-linha">
                <span>Serve</span>
                <span className="ficha-resumo-valor">
                  <input type="number" step="any" min="0" value={serve} onChange={(e) => setServe(e.target.value)} aria-label="Serve (porções)" />
                </span>
              </div>
              <div className="ficha-resumo-linha">
                <span>Peso aproximado</span>
                <span className="ficha-resumo-valor">{formatNumero(resumo.pesoAproximado, 3)} Kg</span>
              </div>
              <div className="ficha-resumo-linha">
                <span>Peso per capita</span>
                <span className="ficha-resumo-valor">{resumo.pesoPerCapita !== null ? `${formatNumero(resumo.pesoPerCapita, 3)} Kg` : '-'}</span>
              </div>
            </>
          )}
        </div>

        <div className="ficha-tabela">
          <div className="ficha-grade ficha-cab">
            <div>Ingredientes</div>
            <div>Observações</div>
            <div>Unid</div>
            <div>Peso líquido</div>
            <div>FC</div>
            <div>Peso bruto</div>
            <div>Medida caseira</div>
            <div>Preço do Kg</div>
            <div>Preço unit</div>
            <div />
          </div>

          {linhas.map((l, i) => {
            const c = calculadas[i]
            const pendente = l.semOrigem && !l.alvo
            const semPreco = !!c.info && c.info.preco === null
            return (
              <div key={l.chave} className={`ficha-grade ficha-linha${pendente ? ' ficha-linha-sem-origem' : ''}`}>
                <div className="ficha-ingrediente">
                  <IngredientePicker opcoes={opcoes} valor={l.alvo} onChange={(chave) => atualizar(l.chave, { alvo: chave })} invalido={pendente} />
                  {pendente && (
                    <>
                      <div className="ficha-sem-origem-texto">{TEXTO_SEM_ORIGEM}</div>
                      {l.origem && <div className="ficha-origem-ref">no arquivo: {l.origem}</div>}
                      {l.motivo && <div className="ficha-origem-ref">{l.motivo}</div>}
                    </>
                  )}
                </div>
                <input type="text" value={l.observacao} onChange={(e) => atualizar(l.chave, { observacao: e.target.value })} aria-label="Observações" />
                <div className="ficha-calc">{c.info?.unidade ?? ''}</div>
                <input type="number" step="any" min="0" value={l.peso} onChange={(e) => atualizar(l.chave, { peso: e.target.value })} aria-label="Peso líquido" />
                <input type="number" step="any" min="0" value={l.fc} onChange={(e) => atualizar(l.chave, { fc: e.target.value })} aria-label="FC" />
                <div className="ficha-calc">{c.info && c.bruto !== null ? formatNumero(c.bruto, 3) : ''}</div>
                <input type="text" value={l.medida} onChange={(e) => atualizar(l.chave, { medida: e.target.value })} aria-label="Medida caseira" />
                <div className={`ficha-calc${semPreco ? ' ficha-sem-preco' : ''}`}>
                  {c.info ? (c.info.preco !== null ? formatCurrency(c.info.preco) : 'sem preço') : ''}
                </div>
                <div className="ficha-calc">{c.unit !== null ? formatCurrency(c.unit) : ''}</div>
                <button type="button" className="ficha-remover" onClick={() => removerLinha(l.chave)} aria-label="Remover ingrediente" title="Remover ingrediente">
                  ✕
                </button>
              </div>
            )
          })}
        </div>

        <div className="ficha-acoes-tabela">
          <button type="button" className="btn-secondary" onClick={adicionarLinha} disabled={linhas.length >= MAX_INGREDIENTES_FICHA}>
            + Adicionar ingrediente
          </button>
          {resumo.incompletas > 0 && (
            <span className="form-info">
              {resumo.incompletas === 1 ? '1 linha está' : `${resumo.incompletas} linhas estão`} incompleta(s) (sem ingrediente, preço, peso ou FC) — o custo
              mostrado é parcial.
            </span>
          )}
        </div>

        <div className="ficha-barra">MODO DE PREPARO:</div>
        <textarea className="ficha-modo" value={modoPreparo} onChange={(e) => setModoPreparo(e.target.value)} rows={10} aria-label="Modo de preparo" />

        {erro && (
          <p className="form-error" style={{ marginTop: 14 }}>
            {erro}
          </p>
        )}

        <div className="modal-footer">
          {ficha ? (
            <button type="button" className="btn-danger" onClick={handleExcluir} disabled={salvando}>
              Excluir
            </button>
          ) : (
            <div />
          )}
          <div className="modal-footer-right">
            <Link href={voltarPara} className="btn-secondary">
              Cancelar
            </Link>
            <button type="submit" className="btn-primary" disabled={salvando}>
              {salvando ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
