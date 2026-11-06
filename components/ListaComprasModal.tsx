'use client'

import { useState } from 'react'
import type { EstoqueItem } from '@/lib/types/domain'
import { formatCurrency } from '@/lib/utils/format'
import { formatarQuantidade, gerarArquivoExcel, itensParaComprar as listarItensParaComprar } from '@/lib/utils/listaCompras'

const GRID = '110px 1fr 200px 140px'

// "YYYY/MM/DD" não dá pra usar num nome de arquivo de verdade — "/" é
// separador de pasta (o Windows recusa, o navegador cortaria o nome no meio)
// — por isso o formato vira "YYYY-MM-DD", mesma ordem ano/mês/dia, só troca
// a barra por hífen.
function nomeArquivo() {
  const hoje = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `lista de compras - ${hoje.getFullYear()}-${pad(hoje.getMonth() + 1)}-${pad(hoje.getDate())}.xlsx`
}

// Itens abaixo do mínimo e a quantidade a comprar (2 casas decimais) vêm de
// lib/utils/listaCompras.ts — a mesma conta vale na tela e no Excel.
export default function ListaComprasModal({ itens, onClose }: { itens: EstoqueItem[]; onClose: () => void }) {
  const [aviso, setAviso] = useState('')

  const itensParaComprar = listarItensParaComprar(itens)

  async function compartilharWhatsApp() {
    setAviso('')
    const blob = gerarArquivoExcel(itensParaComprar)
    const arquivo = new File([blob], nomeArquivo(), { type: blob.type })

    // Celular (Android/iOS): abre a folha de compartilhamento nativa do
    // aparelho com o Excel já anexado — o WhatsApp aparece como uma das
    // opções, igual compartilhar uma foto pelo app de Fotos.
    if (navigator.canShare?.({ files: [arquivo] })) {
      try {
        await navigator.share({ files: [arquivo], title: 'Lista de compras' })
        return
      } catch (erro) {
        if ((erro as Error).name === 'AbortError') return // usuário cancelou
      }
    }

    // Computador: navegadores de mesa não deixam uma página anexar um
    // arquivo direto numa conversa do WhatsApp Web (por segurança). Baixa o
    // Excel e abre o WhatsApp Web com uma mensagem pronta — só falta anexar
    // o arquivo já baixado na conversa que abrir.
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = nomeArquivo()
    link.click()
    URL.revokeObjectURL(url)
    setAviso('Arquivo baixado. Anexe-o na conversa do WhatsApp que vai abrir em seguida.')
    window.open('https://wa.me/?text=' + encodeURIComponent('Lista de compras — Chef Hilana Maia'), '_blank')
  }

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
                {formatarQuantidade(item.qtdComprar, item.unidade_medida)}
              </div>
              <div className="text-strong">{item.nome}</div>
              <div className="col-center text-muted">{item.marca_fornecedor ?? '-'}</div>
              <div className="col-center">{item.preco_corrente != null ? formatCurrency(item.preco_corrente) : '-'}</div>
            </div>
          ))}
        </div>
      )}

      {aviso && (
        <p className="modal-item-label" style={{ marginTop: 12, marginBottom: 0 }}>
          {aviso}
        </p>
      )}

      <div className="modal-footer">
        {itensParaComprar.length > 0 ? (
          <button type="button" className="btn-primary" onClick={compartilharWhatsApp}>
            Compartilhar no WhatsApp
          </button>
        ) : (
          <div />
        )}
        <div className="modal-footer-right">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
