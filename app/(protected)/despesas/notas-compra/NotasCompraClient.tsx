'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Pagination from '@/components/Pagination'
import type { NotaCompra } from '@/lib/types/domain'
import { formatCurrency, formatDateBR } from '@/lib/utils/format'
import { STATUS_NOTA_COMPRA_BADGE, STATUS_NOTA_COMPRA_LABEL } from '@/lib/utils/notaCompra'

const GRID = '1fr 110px 130px 170px 100px'
const ITENS_POR_PAGINA = 15

export default function NotasCompraClient({ notas }: { notas: NotaCompra[] }) {
  const [paginaAtual, setPaginaAtual] = useState(1)

  const notasOrdenadas = useMemo(
    () => [...notas].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [notas]
  )

  useEffect(() => {
    setPaginaAtual(1)
  }, [notasOrdenadas])

  const totalPaginas = Math.max(1, Math.ceil(notasOrdenadas.length / ITENS_POR_PAGINA))
  const notasPaginadas = useMemo(
    () => notasOrdenadas.slice((paginaAtual - 1) * ITENS_POR_PAGINA, paginaAtual * ITENS_POR_PAGINA),
    [notasOrdenadas, paginaAtual]
  )

  return (
    <div>
      <div className="page-header">
        <h1>Notas de compra</h1>
      </div>

      <p className="modal-item-label" style={{ marginBottom: 16 }}>
        Comprovantes de compra lidos por IA. Aprovar aqui grava a despesa geral — a conferência dos itens comprados
        pra dar entrada no estoque é feita depois, na aba Estoque.
      </p>

      <div className="data-table table-scroll">
        <div className="table-row table-head" style={{ gridTemplateColumns: GRID }}>
          <div>ESTABELECIMENTO</div>
          <div className="col-center">DATA</div>
          <div className="col-center">VALOR</div>
          <div className="col-center">STATUS</div>
          <div className="col-center">AÇÃO</div>
        </div>
        {notasPaginadas.map((nota) => (
          <div key={nota.id} className="table-row" style={{ gridTemplateColumns: GRID }}>
            <div className="text-strong">{nota.estabelecimento ?? nota.nome_exibicao ?? 'Lendo...'}</div>
            <div className="col-center text-muted">{nota.data_compra ? formatDateBR(nota.data_compra) : '-'}</div>
            <div className="col-center">{nota.valor_total_lido != null ? formatCurrency(nota.valor_total_lido) : '-'}</div>
            <div className="col-center">
              <span className={`badge ${STATUS_NOTA_COMPRA_BADGE[nota.status]}`}>{STATUS_NOTA_COMPRA_LABEL[nota.status]}</span>
            </div>
            <div className="col-center">
              {(nota.status === 'aguardando_aprovacao' || nota.status === 'falha_leitura') && (
                <Link href={`/despesas/notas-compra/${nota.id}`} className="action-link primary">
                  {nota.status === 'falha_leitura' ? 'revisar' : 'aprovar'}
                </Link>
              )}
              {(nota.status === 'aprovada' || nota.status === 'concluida') && (
                <Link href={`/despesas/notas-compra/${nota.id}`} className="action-link">
                  ver
                </Link>
              )}
            </div>
          </div>
        ))}
        {notasOrdenadas.length === 0 && <div className="empty-state">Nenhuma nota de compra enviada ainda.</div>}
      </div>

      <Pagination
        paginaAtual={paginaAtual}
        totalPaginas={totalPaginas}
        totalItens={notasOrdenadas.length}
        itensPorPagina={ITENS_POR_PAGINA}
        onChange={setPaginaAtual}
      />
    </div>
  )
}
