'use client'

import type { ItemOrcamento, Produto, SecaoOrcamento } from '@/lib/types/domain'
import { calcularResumo, pesoTotalItem, subtotalSecao, valorItem } from '@/lib/utils/orcamento'
import { formatCurrency } from '@/lib/utils/format'

const ITEM_VAZIO: ItemOrcamento = { nome: '', peso_kg: null, valor_unit: 0, quantidade: 1 }

function inputStyle(width: number): React.CSSProperties {
  return { width, padding: '4px 6px', fontSize: 13 }
}

// Reproduz as colunas das planilhas de custo do usuário (Item / Peso Kg /
// Valor Unit. / Peso total / Qtd. / Valor), agrupadas em seções livres
// ("Mesa Fixa", "Prato Quente", "Serviço"...) com subtotal e valor por
// pessoa por seção, e o resumo final (extras % + valor por pessoa) embaixo
// de tudo — igual ao modelo enviado pelo usuário.
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

  function atualizarSecao(index: number, patch: Partial<SecaoOrcamento>) {
    onChangeSecoes(secoes.map((s, i) => (i === index ? { ...s, ...patch } : s)))
  }

  function removerSecao(index: number) {
    onChangeSecoes(secoes.filter((_, i) => i !== index))
  }

  function adicionarSecao() {
    onChangeSecoes([...secoes, { nome: '', tipo: 'comida', itens: [{ ...ITEM_VAZIO }] }])
  }

  function atualizarItem(secaoIndex: number, itemIndex: number, patch: Partial<ItemOrcamento>) {
    const secao = secoes[secaoIndex]
    const itens = secao.itens.map((it, i) => (i === itemIndex ? { ...it, ...patch } : it))
    atualizarSecao(secaoIndex, { itens })
  }

  function removerItem(secaoIndex: number, itemIndex: number) {
    const secao = secoes[secaoIndex]
    atualizarSecao(secaoIndex, { itens: secao.itens.filter((_, i) => i !== itemIndex) })
  }

  function adicionarItem(secaoIndex: number) {
    const secao = secoes[secaoIndex]
    atualizarSecao(secaoIndex, { itens: [...secao.itens, { ...ITEM_VAZIO }] })
  }

  function adicionarDoCatalogo(secaoIndex: number, produtoId: string) {
    const produto = produtos.find((p) => p.id === produtoId)
    if (!produto) return
    const secao = secoes[secaoIndex]
    atualizarSecao(secaoIndex, {
      itens: [
        ...secao.itens,
        { nome: produto.nome, peso_kg: produto.peso_kg_padrao, valor_unit: produto.valor_unit_padrao, quantidade: 1 },
      ],
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {secoes.map((secao, secaoIndex) => {
        const subtotal = subtotalSecao(secao)
        const mostraPeso = secao.tipo === 'comida'
        return (
          <div key={secaoIndex} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
              <input
                type="text"
                placeholder="Nome da seção (ex: Mesa Fixa)"
                value={secao.nome}
                onChange={(e) => atualizarSecao(secaoIndex, { nome: e.target.value })}
                style={{ ...inputStyle(220), fontWeight: 600 }}
              />
              <select
                className="select-control"
                value={secao.tipo}
                onChange={(e) => atualizarSecao(secaoIndex, { tipo: e.target.value as SecaoOrcamento['tipo'] })}
              >
                <option value="comida">Comida (com peso)</option>
                <option value="servico">Serviço (sem peso)</option>
              </select>
              <div style={{ flex: 1 }} />
              <button type="button" className="action-link" onClick={() => removerSecao(secaoIndex)}>
                remover seção
              </button>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr className="text-muted" style={{ textAlign: 'left' }}>
                    <th style={{ padding: '4px 6px' }}>Item</th>
                    {mostraPeso && <th style={{ padding: '4px 6px' }}>Peso Kg</th>}
                    <th style={{ padding: '4px 6px' }}>Valor Unit.</th>
                    {mostraPeso && <th style={{ padding: '4px 6px' }}>Peso total</th>}
                    <th style={{ padding: '4px 6px' }}>Qtd.</th>
                    <th style={{ padding: '4px 6px' }}>Valor</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {secao.itens.map((item, itemIndex) => (
                    <tr key={itemIndex}>
                      <td style={{ padding: '2px 6px' }}>
                        <input
                          type="text"
                          value={item.nome}
                          placeholder="Nome do item"
                          onChange={(e) => atualizarItem(secaoIndex, itemIndex, { nome: e.target.value })}
                          style={inputStyle(180)}
                        />
                      </td>
                      {mostraPeso && (
                        <td style={{ padding: '2px 6px' }}>
                          <input
                            type="number"
                            step="0.001"
                            min="0"
                            value={item.peso_kg ?? ''}
                            onChange={(e) =>
                              atualizarItem(secaoIndex, itemIndex, {
                                peso_kg: e.target.value === '' ? null : Number(e.target.value),
                              })
                            }
                            style={inputStyle(80)}
                          />
                        </td>
                      )}
                      <td style={{ padding: '2px 6px' }}>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.valor_unit}
                          onChange={(e) => atualizarItem(secaoIndex, itemIndex, { valor_unit: Number(e.target.value) || 0 })}
                          style={inputStyle(90)}
                        />
                      </td>
                      {mostraPeso && (
                        <td className="text-muted" style={{ padding: '2px 6px' }}>
                          {pesoTotalItem(item).toLocaleString('pt-BR', { maximumFractionDigits: 3 })}
                        </td>
                      )}
                      <td style={{ padding: '2px 6px' }}>
                        <input
                          type="number"
                          step="1"
                          min="0"
                          value={item.quantidade}
                          onChange={(e) => atualizarItem(secaoIndex, itemIndex, { quantidade: Number(e.target.value) || 0 })}
                          style={inputStyle(70)}
                        />
                      </td>
                      <td className="text-strong" style={{ padding: '2px 6px', whiteSpace: 'nowrap' }}>
                        {formatCurrency(valorItem(item))}
                      </td>
                      <td>
                        <button type="button" className="action-link" onClick={() => removerItem(secaoIndex, itemIndex)}>
                          x
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
              <button type="button" className="btn-secondary" onClick={() => adicionarItem(secaoIndex)}>
                + item em branco
              </button>
              {!!produtos.filter((p) => p.tipo === secao.tipo).length && (
                <select
                  className="select-control"
                  value=""
                  onChange={(e) => {
                    if (e.target.value) adicionarDoCatalogo(secaoIndex, e.target.value)
                  }}
                >
                  <option value="">+ adicionar do catálogo...</option>
                  {produtos
                    .filter((p) => p.tipo === secao.tipo)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome}
                      </option>
                    ))}
                </select>
              )}
            </div>

            <div className="modal-item-label" style={{ marginTop: 10, textAlign: 'right' }}>
              {mostraPeso && <span style={{ marginRight: 16 }}>Peso total: {subtotal.peso.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} kg</span>}
              <strong>Subtotal da seção: {formatCurrency(subtotal.valor)}</strong>
              {!!numeroPessoas && (
                <span style={{ marginLeft: 12 }}>({formatCurrency(subtotal.valor / numeroPessoas)} por pessoa)</span>
              )}
            </div>
          </div>
        )
      })}

      <button type="button" className="btn-secondary" onClick={adicionarSecao}>
        + adicionar seção
      </button>

      {!!secoes.length && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, background: 'var(--bg-subtle, #f7f7f5)' }}>
          <div className="modal-row" style={{ alignItems: 'center' }}>
            <label>
              % extras
              <input
                type="number"
                step="0.1"
                min="0"
                value={percentualExtras}
                onChange={(e) => onChangePercentualExtras(Number(e.target.value) || 0)}
              />
            </label>
            <div />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8, fontSize: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="text-muted">Total (entradas + serviço)</span>
              <span>{formatCurrency(resumo.subtotal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="text-muted">{percentualExtras}% extras</span>
              <span>{formatCurrency(resumo.extras)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
              <span>Valor Total</span>
              <span>{formatCurrency(resumo.valorTotal)}</span>
            </div>
            {!!numeroPessoas && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                <span>Valor por Pessoa</span>
                <span>{formatCurrency(resumo.valorPorPessoa)}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
