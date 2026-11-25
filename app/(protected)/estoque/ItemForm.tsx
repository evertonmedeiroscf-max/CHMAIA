'use client'

import { useEffect, useMemo, useState } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import Link from 'next/link'
import { UNIDADES_MEDIDA, type EstoqueItem } from '@/lib/types/domain'
import { chaveCategoria, limparNomeCategoria } from '@/lib/utils/categoriasEstoque'
import { createEstoqueItem, deleteEstoqueItem, updateEstoqueItem, type ActionState } from './actions'

// Valor da última opção da lista de categorias ("+ Nova categoria…").
const NOVA_CATEGORIA = '__nova_categoria__'

function SaveButton({ formId }: { formId: string }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" form={formId} className="btn-primary" disabled={pending}>
      {pending ? 'Salvando...' : 'Salvar'}
    </button>
  )
}

function DeleteButton() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className="btn-danger" disabled={pending}>
      {pending ? 'Excluindo...' : 'Excluir'}
    </button>
  )
}

// `categorias`: lista completa (as de sempre + as já criadas), em ordem alfabética.
export default function ItemForm({ item, categorias, onClose }: { item?: EstoqueItem; categorias: string[]; onClose: () => void }) {
  // Categoria: escolhida na lista, ou — na opção "+ Nova categoria…" — digitada aqui. O que vai para o
  // servidor é sempre o campo escondido `categoria`; a categoria nova passa a existir quando o item é salvo.
  const [escolha, setEscolha] = useState(item?.categoria ?? categorias[0] ?? '')
  const [novaCategoria, setNovaCategoria] = useState('')
  const criandoCategoria = escolha === NOVA_CATEGORIA
  const jaExiste = criandoCategoria && novaCategoria.trim() ? categorias.find((c) => chaveCategoria(c) === chaveCategoria(novaCategoria)) : undefined
  const categoriaFinal = criandoCategoria ? (jaExiste ?? limparNomeCategoria(novaCategoria)) : escolha

  const action = useMemo(() => (item ? updateEstoqueItem.bind(null, item.id) : createEstoqueItem), [item])
  const [state, formAction] = useFormState(action, undefined)
  const [deleteState, deleteAction] = useFormState(
    item ? deleteEstoqueItem.bind(null, item.id) : async (): Promise<ActionState> => undefined,
    undefined
  )

  useEffect(() => {
    if (state?.success) onClose()
  }, [state, onClose])

  useEffect(() => {
    if (deleteState?.success) onClose()
  }, [deleteState, onClose])

  const formId = item ? `item-form-${item.id}` : 'item-form-novo'

  return (
    <>
      <form id={formId} action={formAction} className="modal-fields">
        <label>
          Nome do item
          <input type="text" name="nome" placeholder="Ex: Queijo Muçarela" defaultValue={item?.nome ?? ''} required />
        </label>
        <label>
          Categoria
          <select value={escolha} onChange={(e) => setEscolha(e.target.value)}>
            {categorias.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            <option value={NOVA_CATEGORIA}>+ Nova categoria…</option>
          </select>
        </label>
        {criandoCategoria && (
          <label>
            Nome da nova categoria
            <input
              type="text"
              value={novaCategoria}
              onChange={(e) => setNovaCategoria(e.target.value)}
              placeholder="Ex: Congelados"
              maxLength={60}
              required
              autoFocus
            />
          </label>
        )}
        {jaExiste && <p className="form-info">Já existe a categoria &quot;{jaExiste}&quot;: o item vai ficar nela.</p>}
        <input type="hidden" name="categoria" value={categoriaFinal} />
        <label>
          Unidade
          <select name="unidade_medida" defaultValue={item?.unidade_medida ?? UNIDADES_MEDIDA[0]}>
            {UNIDADES_MEDIDA.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </label>
        <div className="modal-row">
          <label>
            Preço corrente (R$)
            <input type="number" name="preco_corrente" step="0.01" min="0" defaultValue={item?.preco_corrente ?? ''} />
          </label>
          <label>
            FC
            <input type="number" name="fc" step="any" min="0" placeholder="Ex: 1,25" defaultValue={item?.fc ?? ''} />
          </label>
          <label>
            Custo / und. (R$)
            <input type="number" name="custo_unidade" step="0.01" min="0" defaultValue={item?.custo_unidade ?? ''} />
          </label>
        </div>
        {item?.fc_sem_origem && (
          <p className="form-info">
            Não conseguiu obter informação do arquivo de origem: o FC deste item ficou em branco na importação. Preencha
            o FC acima para tirar o realce.
          </p>
        )}
        <label>
          Observação
          <input
            type="text"
            name="observacao"
            placeholder="Ex: Comprar só do fornecedor X"
            maxLength={500}
            defaultValue={item?.observacao ?? ''}
          />
        </label>
        <label>
          Marca / Fornecedor
          <input
            type="text"
            name="marca_fornecedor"
            placeholder="Ex: Sadia"
            defaultValue={item?.marca_fornecedor ?? ''}
          />
        </label>
        <div className="modal-row">
          <label>
            Qtd. atual
            <input type="number" name="quantidade_atual" step="0.01" min="0" defaultValue={item?.quantidade_atual ?? 0} />
          </label>
          <label>
            Qtd. mínima
            <input type="number" name="quantidade_minima" step="0.01" min="0" defaultValue={item?.quantidade_minima ?? 0} />
          </label>
        </div>
        {item && (
          <>
            <p className="modal-item-label">
              Mudar a quantidade atual aqui registra um movimento de ajuste automaticamente (visível no histórico do
              item) — para entradas/saídas do dia a dia, prefira o botão &quot;movimentar&quot;.
            </p>
            <Link href={`/estoque/${item.id}`} className="modal-link-historico">
              Ver histórico de movimentos →
            </Link>
          </>
        )}
      </form>

      {state?.error && <p className="form-error" style={{ marginTop: 14 }}>{state.error}</p>}
      {deleteState?.error && <p className="form-error" style={{ marginTop: 14 }}>{deleteState.error}</p>}

      <div className="modal-footer">
        {item ? (
          <form action={deleteAction}>
            <DeleteButton />
          </form>
        ) : (
          <div />
        )}
        <div className="modal-footer-right">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <SaveButton formId={formId} />
        </div>
      </div>
    </>
  )
}
