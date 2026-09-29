'use client'

import type { EstoqueItem } from '@/lib/types/domain'
import { formatCurrency } from '@/lib/utils/format'

const GRID = '110px 1fr 200px 140px'

// Mesmo critério de "estoque baixo" já usado na tabela principal (flag
// ESTOQUE BAIXO em EstoqueClient) — abaixo do mínimo, não igual a ele.
export default function ListaComprasModal({ itens, onClose }: { itens: EstoqueItem[]; onClose: () => void }) {
  const itensParaComprar = itens
    .filter((item) => item.quantidade_atual < item.quantidade_minima)
    .map((item) => ({ ...item, qtdComprar: item.quantidade_minima - item.quantidade_atual }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

  return (
    <div>
      <p className="modal-item-label" style={{ marginTop: -12, marginBottom: 18 }}>
        {itensParaComprar.length === 0
          ? 'Nenhum item está abaixo do estoque mínimo no momento.'
          : `${itensParaComprar.length} ${itensParaComprar.length === 1 ? 'item está' : 'itens estão'} abaixo do estoque mínimo e precisam de reposição.`}
      </p>

      {itensParaComprar.length > 0 && (
        <div className="data-table">
          <div className="table-row table-head" style={{ gridTemplateColumns: GRID }}>
            <div className="col-center">QTD.</div>
            <div>NOME DO PRODUTO</div>
            <div className="col-center">MARCA / FORNECEDOR</div>
            <div className="col-center">PREÇO CORRENTE</div>
          </div>
          {itensParaComprar.map((item) => (
            <div key={item.id} className="table-row" style={{ gridTemplateColumns: GRID }}>
              <div className="col-center" style={{ fontWeight: 600 }}>
                {item.qtdComprar} {item.unidade_medida}
              </div>
              <div className="text-strong">{item.nome}</div>
              <div className="col-center text-muted">{item.marca_fornecedor ?? '-'}</div>
              <div className="col-center">{item.preco_corrente != null ? formatCurrency(item.preco_corrente) : '-'}</div>
            </div>
          ))}
        </div>
      )}

      <div className="modal-footer">
        <div />
        <div className="modal-footer-right">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
