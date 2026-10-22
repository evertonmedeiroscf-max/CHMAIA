'use client'

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { FichaTecnica, FichaTecnicaIngrediente, ItemEstoqueFicha } from '@/lib/types/domain'
import { formatCurrency } from '@/lib/utils/format'
import { calcularFicha, formatNumero, pesoBruto, precoUnitario } from '@/lib/utils/fichaTecnica'
import { MAX_INGREDIENTES_FICHA } from '@/lib/validations/fichaTecnica'
import EstoqueItemPicker from './EstoqueItemPicker'
import { excluirFichaTecnica, salvarFichaTecnica } from './actions'

type LinhaForm = {
  chave: number
  id: string | null
  estoque_item_id: string
  observacao: string
  peso_liquido: string
  fc: string
  medida_caseira: string
}

const LINHAS_INICIAIS_FICHA_NOVA = 3

function numero(texto: string): number {
  const n = Number(texto.replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

// Linha totalmente em branco (só o FC padrão "1"): é ignorada ao salvar, como as
// linhas vazias da planilha.
function linhaVazia(l: LinhaForm) {
  return !l.estoque_item_id && !l.observacao.trim() && !l.peso_liquido.trim() && !l.medida_caseira.trim()
}

export default function FichaEditor({
  ficha,
  ingredientes,
  itens,
}: {
  ficha?: FichaTecnica
  ingredientes: FichaTecnicaIngrediente[]
  itens: ItemEstoqueFicha[]
}) {
  const router = useRouter()
  const proximaChave = useRef(0)
  const novaChave = () => ++proximaChave.current

  const [nome, setNome] = useState(ficha?.nome ?? '')
  const [rendimento, setRendimento] = useState(ficha ? String(ficha.rendimento_kg) : '')
  const [dataAtualizacao, setDataAtualizacao] = useState(ficha?.data_atualizacao ?? '')
  const [modoPreparo, setModoPreparo] = useState(ficha?.modo_preparo ?? '')
  const [linhas, setLinhas] = useState<LinhaForm[]>(() =>
    ficha
      ? ingredientes.map((i) => ({
          chave: novaChave(),
          id: i.id,
          estoque_item_id: i.estoque_item_id,
          observacao: i.observacao ?? '',
          peso_liquido: String(i.peso_liquido),
          fc: String(i.fc),
          medida_caseira: i.medida_caseira ?? '',
        }))
      : Array.from({ length: LINHAS_INICIAIS_FICHA_NOVA }, () => ({
          chave: novaChave(),
          id: null,
          estoque_item_id: '',
          observacao: '',
          peso_liquido: '',
          fc: '1',
          medida_caseira: '',
        }))
  )
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const enviandoRef = useRef(false)

  const itemPorId = useMemo(() => new Map(itens.map((i) => [i.id, i])), [itens])

  const calculadas = linhas.map((l) => {
    const item = itemPorId.get(l.estoque_item_id)
    const base = { peso_liquido: numero(l.peso_liquido), fc: numero(l.fc), preco_kg: item ? item.preco_corrente : null }
    return { item, bruto: pesoBruto(base), unit: item ? precoUnitario(base) : null, base }
  })
  const resumo = calcularFicha(
    linhas.flatMap((l, i) => (l.estoque_item_id ? [calculadas[i].base] : [])),
    numero(rendimento)
  )

  function atualizar(chave: number, campos: Partial<LinhaForm>) {
    setLinhas((atuais) => atuais.map((l) => (l.chave === chave ? { ...l, ...campos } : l)))
  }

  function adicionarLinha() {
    setLinhas((atuais) =>
      atuais.length >= MAX_INGREDIENTES_FICHA
        ? atuais
        : [...atuais, { chave: novaChave(), id: null, estoque_item_id: '', observacao: '', peso_liquido: '', fc: '1', medida_caseira: '' }]
    )
  }

  function removerLinha(chave: number) {
    setLinhas((atuais) => atuais.filter((l) => l.chave !== chave))
  }

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault()
    if (enviandoRef.current) return
    setErro('')

    const preenchidas = linhas.filter((l) => !linhaVazia(l))
    if (preenchidas.some((l) => !l.estoque_item_id)) {
      setErro('Escolha o ingrediente em todas as linhas preenchidas (ou apague as linhas em branco).')
      return
    }

    const semPeso = preenchidas.find((l) => l.peso_liquido.trim() === '')
    if (semPeso) {
      setErro(`Informe o peso líquido de ${itemPorId.get(semPeso.estoque_item_id)?.nome ?? 'todos os ingredientes'}.`)
      return
    }

    enviandoRef.current = true
    setSalvando(true)
    try {
      const resultado = await salvarFichaTecnica(ficha?.id ?? null, {
        nome,
        rendimento_kg: rendimento,
        data_atualizacao: dataAtualizacao || null,
        modo_preparo: modoPreparo || null,
        ingredientes: preenchidas.map((l) => ({
          id: l.id,
          estoque_item_id: l.estoque_item_id,
          observacao: l.observacao,
          peso_liquido: l.peso_liquido,
          fc: l.fc,
          medida_caseira: l.medida_caseira,
        })),
      })
      if ('error' in resultado) {
        setErro(resultado.error)
        return
      }
      router.push('/fichas-tecnicas')
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

  return (
    <div>
      <div className="page-header">
        <h1>{ficha ? 'Editar ficha técnica' : 'Nova ficha técnica'}</h1>
        <Link href="/fichas-tecnicas" className="btn-secondary">
          ← Voltar para Fichas técnicas
        </Link>
      </div>

      <form className="ficha" onSubmit={handleSalvar}>
        <div className="ficha-barra">CHEF HILANA MAIA GASTRONOMIA</div>
        <div className="ficha-barra">FICHA TÉCNICA DE PREPARO - BASES</div>
        <div className="ficha-barra ficha-barra-nome">
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="NOME DA RECEITA"
            aria-label="Nome da receita"
            required
          />
        </div>

        <div className="ficha-resumo">
          <div className="ficha-resumo-linha">
            <span className="ficha-data-rotulo">DATA ATUALIZAÇÃO:</span>
            <input type="date" value={dataAtualizacao} onChange={(e) => setDataAtualizacao(e.target.value)} aria-label="Data de atualização" />
          </div>
          <div className="ficha-resumo-linha">
            <span>Rendimento total da receita</span>
            <span className="ficha-resumo-valor">
              <input
                type="number"
                step="any"
                min="0"
                value={rendimento}
                onChange={(e) => setRendimento(e.target.value)}
                aria-label="Rendimento total em kg"
                required
              />{' '}
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
            const semPreco = !!c.item && c.item.preco_corrente === null
            return (
              <div key={l.chave} className="ficha-grade ficha-linha">
                <EstoqueItemPicker
                  itens={itens}
                  valor={l.estoque_item_id}
                  onChange={(itemId) => atualizar(l.chave, { estoque_item_id: itemId })}
                />
                <input
                  type="text"
                  value={l.observacao}
                  onChange={(e) => atualizar(l.chave, { observacao: e.target.value })}
                  aria-label="Observações"
                />
                <div className="ficha-calc">{c.item?.unidade_medida ?? ''}</div>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={l.peso_liquido}
                  onChange={(e) => atualizar(l.chave, { peso_liquido: e.target.value })}
                  aria-label="Peso líquido"
                />
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={l.fc}
                  onChange={(e) => atualizar(l.chave, { fc: e.target.value })}
                  aria-label="FC"
                />
                <div className="ficha-calc">{c.item ? formatNumero(c.bruto, 3) : ''}</div>
                <input
                  type="text"
                  value={l.medida_caseira}
                  onChange={(e) => atualizar(l.chave, { medida_caseira: e.target.value })}
                  aria-label="Medida caseira"
                />
                <div className={`ficha-calc${semPreco ? ' ficha-sem-preco' : ''}`}>
                  {c.item ? (c.item.preco_corrente !== null ? formatCurrency(c.item.preco_corrente) : 'sem preço') : ''}
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
          {resumo.semPreco > 0 && (
            <span className="form-info">
              {resumo.semPreco === 1 ? '1 ingrediente está' : `${resumo.semPreco} ingredientes estão`} sem preço no Estoque — o custo
              mostrado é parcial.
            </span>
          )}
        </div>

        <div className="ficha-barra">MODO DE PREPARO:</div>
        <textarea
          className="ficha-modo"
          value={modoPreparo}
          onChange={(e) => setModoPreparo(e.target.value)}
          rows={10}
          aria-label="Modo de preparo"
        />

        {erro && <p className="form-error" style={{ marginTop: 14 }}>{erro}</p>}

        <div className="modal-footer">
          {ficha ? (
            <button type="button" className="btn-danger" onClick={handleExcluir} disabled={salvando}>
              Excluir
            </button>
          ) : (
            <div />
          )}
          <div className="modal-footer-right">
            <Link href="/fichas-tecnicas" className="btn-secondary">
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
