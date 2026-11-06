'use client'

import { useState } from 'react'
import Link from 'next/link'
import IndiceFichas from './IndiceFichas'
import TabelaFichas from './TabelaFichas'
import type { FichaListada } from './listagem'

type Visao = 'indice' | 'tabela'

export default function FichasTecnicasClient({ fichas }: { fichas: FichaListada[] }) {
  const [visao, setVisao] = useState<Visao>('indice')

  return (
    <div>
      <div className="page-header">
        <h1>Fichas técnicas</h1>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div className="view-toggle">
            <button type="button" className={visao === 'indice' ? 'active' : ''} onClick={() => setVisao('indice')}>
              Índice
            </button>
            <button type="button" className={visao === 'tabela' ? 'active' : ''} onClick={() => setVisao('tabela')}>
              Tabela
            </button>
          </div>
          <Link href="/fichas-tecnicas/nova?tipo=bases" className="btn-secondary">
            + Nova ficha de Base
          </Link>
          <Link href="/fichas-tecnicas/nova?tipo=finalizacao" className="btn-primary">
            + Nova ficha de Finalização
          </Link>
        </div>
      </div>

      <p className="modal-item-label" style={{ marginBottom: 16 }}>
        A ficha de <strong>Base</strong> traz a receita e o custo do kg. A ficha de <strong>Finalização</strong> é gerada a partir da Base do mesmo produto,
        para variar a quantidade e precificar com o Markup. O custo usa o preço corrente dos ingredientes no Estoque e acompanha qualquer mudança lá.
        Clique no nome para abrir a ficha.
      </p>

      {visao === 'indice' ? <IndiceFichas fichas={fichas} /> : <TabelaFichas fichas={fichas} />}
    </div>
  )
}
