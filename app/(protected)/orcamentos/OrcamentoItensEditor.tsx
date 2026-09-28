'use client'

import type { ItemOrcamento, Produto, SecaoOrcamento } from '@/lib/types/domain'
import {
  calcularResumo,
  pesoTotalItem,
  SECOES_ORCAMENTO,
  secaoOpcional,
  subtotalSecao,
  sugerirEquipe,
  valorItem,
  valorOpcionalPorPessoa,
} from '@/lib/utils/orcamento'
import { formatCurrency } from '@/lib/utils/format'
import SeletorCatalogo from './SeletorCatalogo'

const ITEM_VAZIO: ItemOrcamento = { nome: '', peso_kg: null, valor_unit: 0, quantidade: 1, observacao: null }

const kg = (v: number, casas = 3) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: casas })} kg`

// Planilha de orçamento no formato do "modelo orçamento.xlsx" do usuário:
// uma tabela contínua (Item / Peso Kg / Valor Unit. / Peso total / Qtd. /
// Valor) com as seções em faixas ("Mesa Fixa", "Jantar", "Serviço"...),
// total e "por pessoa" de cada seção, Peso Total Comida / Comida por
// Pessoa, e o fechamento (Valor Total, % extras, Valor por Pessoa).
export default function OrcamentoItensEditor({
  secoes,
  onChangeSecoes,
  percentualExtras,
  onChangePercentualExtras,
  numeroPessoas,
  produtos,
}: {
  secoes: SecaoOrcamento[]
  onChangeSecoes: (secoes: SecaoOrcamento[]) => void
  percentualExtras: number
  onChangePercentualExtras: (valor: number) => void
  numeroPessoas: number | null
  produtos: Produto[]
}) {
  const resumo = calcularResumo(secoes, percentualExtras, numeroPessoas)
  const pessoas = numeroPessoas || 0
  const porPessoa = (v: number) => (pessoas ? v / pessoas : 0)

  const secoesComida = secoes.filter((s) => s.tipo === 'comida' && !secaoOpcional(s))
  const comida = secoesComida.reduce(
    (acc, s) => {
      const sub = subtotalSecao(s)
      return { peso: acc.peso + sub.peso, valor: acc.valor + sub.valor }
    },
    { peso: 0, valor: 0 }
  )
  const equipe = pessoas ? sugerirEquipe(pessoas) : null

  function atualizarSecao(index: number, patch: Partial<SecaoOrcamento>) {
    onChangeSecoes(secoes.map((s, i) => (i === index ? { ...s, ...patch } : s)))
  }

  function removerSecao(index: number) {
    const secao = secoes[index]
    const temConteudo = secao.itens.some((it) => it.nome || it.valor_unit)
    if (temConteudo && !confirm(`Remover a seção "${secao.nome || 'sem nome'}" e todos os itens dela?`)) return
    onChangeSecoes(secoes.filter((_, i) => i !== index))
  }

  function moverSecao(index: number, delta: number) {
    const destino = index + delta
    if (destino < 0 || destino >= secoes.length) return
    const copia = [...secoes]
    ;[copia[index], copia[destino]] = [copia[destino], copia[index]]
    onChangeSecoes(copia)
  }

  // Nova seção já vem com a primeira opção do seletor ainda não usada
  // naquele tipo (ex.: depois de "Mesa fixa", a próxima de comida).
  function adicionarSecao(tipo: SecaoOrcamento['tipo']) {
    const usadas = new Set(secoes.map((s) => s.nome))
    const opcoes = SECOES_ORCAMENTO.filter((o) => o.tipo === tipo)
    const nome = (opcoes.find((o) => !usadas.has(o.nome)) ?? opcoes[0]).nome
    onChangeSecoes([...secoes, { nome, tipo, itens: [] }])
  }

  function atualizarItem(secaoIndex: number, itemIndex: number, patch: Partial<ItemOrcamento>) {
    const secao = secoes[secaoIndex]
    atualizarSecao(secaoIndex, { itens: secao.itens.map((it, i) => (i === itemIndex ? { ...it, ...patch } : it)) })
  }

  function removerItem(secaoIndex: number, itemIndex: number) {
    const secao = secoes[secaoIndex]
    atualizarSecao(secaoIndex, { itens: secao.itens.filter((_, i) => i !== itemIndex) })
  }

  function adicionarItem(secaoIndex: number) {
    const secao = secoes[secaoIndex]
    atualizarSecao(secaoIndex, { itens: [...secao.itens, { ...ITEM_VAZIO }] })
  }

  // Itens do catálogo entram depois dos já preenchidos; uma linha ainda em
  // branco (a que o modelo cria) é substituída em vez de ficar sobrando.
  function adicionarDoCatalogo(secaoIndex: number, selecionados: Produto[]) {
    if (!selecionados.length) return
    const secao = secoes[secaoIndex]
    const preenchidos = secao.itens.filter((it) => it.nome.trim() || it.valor_unit)
    const novos: ItemOrcamento[] = selecionados.map((p) => ({
      nome: p.nome,
      peso_kg: p.peso_kg_padrao,
      valor_unit: p.valor_unit_padrao,
      quantidade: 1,
      observacao: p.observacao,
    }))
    atualizarSecao(secaoIndex, { itens: [...preenchidos, ...novos] })
  }

  const numero = (valor: string) => (valor === '' ? 0 : Number(valor.replace(',', '.')) || 0)

  let contador = 0

  return (
    <div className="planilha-wrap">
      <table className="planilha">
        <colgroup>
          <col style={{ width: 34 }} />
          <col />
          <col style={{ width: 86 }} />
          <col style={{ width: 104 }} />
          <col style={{ width: 92 }} />
          <col style={{ width: 76 }} />
          <col style={{ width: 118 }} />
          <col style={{ width: 30 }} />
        </colgroup>
        <thead>
          <tr>
            <th>#</th>
            <th>Item</th>
            <th className="num">Peso Kg</th>
            <th className="num">Valor Unit.</th>
            <th className="num">Peso total</th>
            <th className="num">Qtd.</th>
            <th className="num">Valor</th>
            <th />
          </tr>
        </thead>

        {secoes.map((secao, secaoIndex) => {
          const subtotal = subtotalSecao(secao)
          const ehComida = secao.tipo === 'comida'
          const catalogo = produtos.filter((p) => p.tipo === secao.tipo)
          const nome = secao.nome.trim() || (ehComida ? 'seção' : 'Serviço')
          return (
            <tbody key={secaoIndex}>
              <tr className="planilha-secao">
                <td colSpan={8}>
                  <div className="planilha-secao-conteudo">
                    <select
                      className="select-control planilha-secao-nome"
                      value={secao.nome}
                      aria-label="Seção"
                      onChange={(e) => {
                        const opcao = SECOES_ORCAMENTO.find((o) => o.nome === e.target.value)
                        atualizarSecao(secaoIndex, { nome: e.target.value, ...(opcao && { tipo: opcao.tipo }) })
                      }}
                    >
                      {!secao.nome && <option value="">Escolha a seção…</option>}
                      {SECOES_ORCAMENTO.map((o) => (
                        <option key={o.nome} value={o.nome}>
                          {o.nome.toUpperCase()}
                        </option>
                      ))}
                      {/* Orçamentos antigos podem ter nomes fora da lista (ex.: "Jantar"). */}
                      {!!secao.nome && !SECOES_ORCAMENTO.some((o) => o.nome === secao.nome) && (
                        <option value={secao.nome}>{secao.nome.toUpperCase()}</option>
                      )}
                    </select>
                    <select
                      className="select-control"
                      value={secao.tipo}
                      onChange={(e) => atualizarSecao(secaoIndex, { tipo: e.target.value as SecaoOrcamento['tipo'] })}
                    >
                      <option value="comida">Comida (com peso)</option>
                      <option value="servico">Serviço (sem peso)</option>
                    </select>
                    <div style={{ flex: 1 }} />
                    <button type="button" className="action-link" onClick={() => moverSecao(secaoIndex, -1)} title="Subir seção">
                      ↑
                    </button>
                    <button type="button" className="action-link" onClick={() => moverSecao(secaoIndex, 1)} title="Descer seção">
                      ↓
                    </button>
                    <button type="button" className="action-link" onClick={() => removerSecao(secaoIndex)}>
                      remover seção
                    </button>
                  </div>
                </td>
              </tr>

              {secao.itens.map((item, itemIndex) => {
                contador += 1
                return (
                  <tr key={itemIndex} className="planilha-item">
                    <td className="planilha-indice">{contador}</td>
                    <td className="planilha-item-nome">
                      <input
                        type="text"
                        value={item.nome}
                        placeholder="Nome do item"
                        title={item.nome}
                        onChange={(e) => atualizarItem(secaoIndex, itemIndex, { nome: e.target.value })}
                      />
                      <input
                        type="text"
                        className="planilha-item-obs"
                        value={item.observacao ?? ''}
                        placeholder="observação"
                        title={item.observacao ?? undefined}
                        onChange={(e) => atualizarItem(secaoIndex, itemIndex, { observacao: e.target.value || null })}
                      />
                    </td>
                    <td>
                      {ehComida && (
                        <input
                          type="number"
                          step="any"
                          min="0"
                          className="num"
                          value={item.peso_kg ?? ''}
                          onChange={(e) =>
                            atualizarItem(secaoIndex, itemIndex, {
                              peso_kg: e.target.value === '' ? null : numero(e.target.value),
                            })
                          }
                        />
                      )}
                    </td>
                    <td>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        className="num"
                        value={item.valor_unit || ''}
                        placeholder="0,00"
                        onChange={(e) => atualizarItem(secaoIndex, itemIndex, { valor_unit: numero(e.target.value) })}
                      />
                    </td>
                    <td className="num text-muted">{ehComida && item.peso_kg != null ? kg(pesoTotalItem(item)) : ''}</td>
                    <td>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        className="num"
                        value={item.quantidade || ''}
                        placeholder="0"
                        onChange={(e) => atualizarItem(secaoIndex, itemIndex, { quantidade: numero(e.target.value) })}
                      />
                    </td>
                    <td className="num text-strong">{formatCurrency(valorItem(item))}</td>
                    <td>
                      <button
                        type="button"
                        className="planilha-remover"
                        onClick={() => removerItem(secaoIndex, itemIndex)}
                        title="Remover item"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                )
              })}

              <tr className="planilha-acoes">
                <td />
                <td colSpan={7}>
                  <button type="button" className="action-link" onClick={() => adicionarItem(secaoIndex)}>
                    + item
                  </button>
                  {!!catalogo.length && (
                    <SeletorCatalogo produtos={catalogo} onAdicionar={(sel) => adicionarDoCatalogo(secaoIndex, sel)} />
                  )}
                  {!ehComida && equipe && (
                    <span className="planilha-dica">
                      Regra de equipe p/ {pessoas} pessoas: {equipe.auxiliares} auxiliares + {equipe.garcons} garçons (
                      {equipe.auxiliares + equipe.garcons} no total)
                    </span>
                  )}
                </td>
              </tr>

              <tr className="planilha-total">
                <td />
                <td colSpan={3}>
                  Total {ehComida ? `de ${nome.toLowerCase()}` : nome.toLowerCase()}
                  {secaoOpcional(secao) && <span className="planilha-opcional"> · opcional, fora do total</span>}
                </td>
                <td className="num">{ehComida ? kg(subtotal.peso) : ''}</td>
                <td />
                <td className="num">{formatCurrency(subtotal.valor)}</td>
                <td />
              </tr>
              {secaoOpcional(secao) ? (
                <tr className="planilha-por-pessoa">
                  <td />
                  <td colSpan={5}>Adicional por pessoa (com {percentualExtras}% extras) — aparece assim na proposta</td>
                  <td className="num">
                    {pessoas ? formatCurrency(valorOpcionalPorPessoa(secao, percentualExtras, pessoas)) : '—'}
                  </td>
                  <td />
                </tr>
              ) : ehComida && (
                <tr className="planilha-por-pessoa">
                  <td />
                  <td colSpan={3}>{nome.charAt(0).toUpperCase() + nome.slice(1)} por pessoa</td>
                  <td className="num">{pessoas ? kg(porPessoa(subtotal.peso)) : '—'}</td>
                  <td />
                  <td className="num">{pessoas ? formatCurrency(porPessoa(subtotal.valor)) : '—'}</td>
                  <td />
                </tr>
              )}
            </tbody>
          )
        })}

        {!!secoes.length && (
          <tbody className="planilha-fechamento">
            {!!secoesComida.length && (
              <>
                <tr className="planilha-total">
                  <td />
                  <td colSpan={3}>Peso Total Comida</td>
                  <td className="num">{kg(comida.peso)}</td>
                  <td />
                  <td className="num">{formatCurrency(comida.valor)}</td>
                  <td />
                </tr>
                <tr className="planilha-por-pessoa">
                  <td />
                  <td colSpan={3}>Comida por Pessoa</td>
                  <td className="num">{pessoas ? kg(porPessoa(comida.peso)) : '—'}</td>
                  <td />
                  <td className="num">{pessoas ? formatCurrency(porPessoa(comida.valor)) : '—'}</td>
                  <td />
                </tr>
              </>
            )}
            <tr className="planilha-total">
              <td />
              <td colSpan={5}>Valor Total</td>
              <td className="num">{formatCurrency(resumo.subtotal)}</td>
              <td />
            </tr>
            <tr>
              <td />
              <td colSpan={5}>
                <label className="planilha-extras">
                  <input
                    type="number"
                    step="any"
                    min="0"
                    className="num"
                    value={percentualExtras || ''}
                    placeholder="0"
                    onChange={(e) => onChangePercentualExtras(numero(e.target.value))}
                  />
                  % extras
                </label>
              </td>
              <td className="num">{formatCurrency(resumo.extras)}</td>
              <td />
            </tr>
            <tr className="planilha-final">
              <td />
              <td colSpan={5}>Valor Total</td>
              <td className="num">{formatCurrency(resumo.valorTotal)}</td>
              <td />
            </tr>
            <tr className="planilha-final">
              <td />
              <td colSpan={5}>Valor por Pessoa {pessoas ? `(${pessoas} pessoas)` : ''}</td>
              <td className="num">{pessoas ? formatCurrency(resumo.valorPorPessoa) : '—'}</td>
              <td />
            </tr>
          </tbody>
        )}
      </table>

      {!pessoas && !!secoes.length && (
        <p className="planilha-dica" style={{ marginTop: 8 }}>
          Preencha o Nº de pessoas acima para ver os valores e pesos por pessoa.
        </p>
      )}

      <div className="planilha-rodape">
        <button type="button" className="btn-secondary" onClick={() => adicionarSecao('comida')}>
          + seção de comida
        </button>
        <button type="button" className="btn-secondary" onClick={() => adicionarSecao('servico')}>
          + seção de serviço
        </button>
      </div>
    </div>
  )
}
