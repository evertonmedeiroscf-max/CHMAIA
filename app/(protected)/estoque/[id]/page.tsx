import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import ConfirmSubmitButton from '@/components/ConfirmSubmitButton'
import { deleteMovimento } from '../actions'
import { formatDateBR } from '@/lib/utils/format'
import type { EstoqueMovimento } from '@/lib/types/domain'

const HISTORICO_GRID = '110px 100px 110px 1fr 90px'

export default async function HistoricoEstoquePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const [{ data: item }, { data: movimentos }] = await Promise.all([
    supabase.from('estoque_itens').select('*').eq('id', id).single(),
    supabase
      .from('estoque_movimentos')
      .select('*')
      .eq('item_id', id)
      .order('data', { ascending: false })
      .order('created_at', { ascending: false }),
  ])

  if (!item) notFound()

  const listaMovimentos = (movimentos ?? []) as EstoqueMovimento[]

  return (
    <div>
      <div className="page-header">
        <h1>{item.nome}</h1>
        <Link href="/estoque">Voltar</Link>
      </div>

      <h2>Histórico de movimentos</h2>
      <div className="data-table">
        <div className="table-row table-head" style={{ gridTemplateColumns: HISTORICO_GRID }}>
          <div className="col-center">DATA</div>
          <div className="col-center">TIPO</div>
          <div className="col-center">QUANTIDADE</div>
          <div>MOTIVO</div>
          <div></div>
        </div>
        {listaMovimentos.map((mov) => (
          <div key={mov.id} className="table-row" style={{ gridTemplateColumns: HISTORICO_GRID }}>
            <div className="col-center text-muted">{formatDateBR(mov.data)}</div>
            <div className="col-center text-muted">{mov.tipo === 'entrada' ? 'Entrada' : 'Saída'}</div>
            <div className="col-center" style={{ fontWeight: 600 }}>
              {mov.tipo === 'entrada' ? '+' : '-'}
              {mov.quantidade}
            </div>
            <div className="text-muted">{mov.motivo ?? '-'}</div>
            <div className="col-center">
              <form action={deleteMovimento.bind(null, item.id, mov.id)}>
                <ConfirmSubmitButton confirmMessage="Excluir este movimento? A quantidade em estoque será revertida.">
                  Excluir
                </ConfirmSubmitButton>
              </form>
            </div>
          </div>
        ))}
        {listaMovimentos.length === 0 && <div className="empty-state">Nenhum movimento registrado.</div>}
      </div>
    </div>
  )
}
