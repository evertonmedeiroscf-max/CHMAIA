'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Pagination from '@/components/Pagination'
import type { NotaCompra, NotaCompraItem } from '@/lib/types/domain'
import { formatDateBR } from '@/lib/utils/format'
import { STATUS_NOTA_COMPRA_BADGE, STATUS_NOTA_COMPRA_LABEL } from '@/lib/utils/notaCompra'

const GRID = '1fr 110px 170px 130px 100px'
const ITENS_POR_PAGINA = 15

export default function NotasCompraEstoqueClient({ notas, itens }: { notas: NotaCompra[]; itens: NotaCompraItem[] }) {
  const [paginaAtual, setPaginaAtual] = useState(1)

  const pendentesPorNota = useMemo(() => {
    const mapa = new Map<string, number>()
    itens.forEach((item) => {
      if (!item.validado) mapa.set(item.nota_id, (mapa.get(item.nota_id) ?? 0) + 1)
    })
    return mapa
  }, [itens])

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
        Notas já aprovadas em Despesas. Confira os itens de cada uma e confirme os que devem dar entrada no estoque —
        sem prazo, no seu ritmo.
      </p>

      <div className="data-table table-scroll">
        <div className="table-row table-head" style={{ gridTemplateColumns: GRID }}>
          <div>ESTABELECIMENTO</div>
          <div className="col-center">DATA</div>
          <div className="col-center">STATUS</div>
          <div className="col-center">ITENS PENDENTES</div>
          <div className="col-center">AÇÃO</div>
        </div>
        {notasPaginadas.map((nota) => (
          <div key={nota.id} className="table-row" style={{ gridTemplateColumns: GRID }}>
            <div className="text-strong">{nota.estabelecimento ?? nota.nome_exibicao ?? '-'}</div>
            <div className="col-center text-muted">{nota.data_compra ? formatDateBR(nota.data_compra) : '-'}</div>
            <div className="col-center">
              <span className={`badge ${STATUS_NOTA_COMPRA_BADGE[nota.status]}`}>{STATUS_NOTA_COMPRA_LABEL[nota.status]}</span>
            </div>
            <div className="col-center">{pendentesPorNota.get(nota.id) ?? 0}</div>
            <div className="col-center">
              <Link href={`/estoque/notas-compra/${nota.id}`} className="action-link primary">
                conferir
              </Link>
            </div>
          </div>
        ))}
        {notasOrdenadas.length === 0 && (
          <div className="empty-state">Nenhuma nota aprovada aguardando conferência no estoque.</div>
        )}
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
