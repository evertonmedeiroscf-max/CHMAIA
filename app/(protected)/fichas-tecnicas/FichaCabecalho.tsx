import type { ReactNode } from 'react'
import { TIPO_FICHA_TITULO, type TipoFicha } from '@/lib/types/domain'

// Topo da ficha, como na planilha: logotipo à esquerda e, ao lado, as três
// faixas vermelhas (empresa, tipo da ficha e nome da receita). A empresa é
// sempre "CHEF HILANA MAIA GASTRONOMIA" — o arquivo de origem trazia outro
// nome na maioria das fichas, mas a decisão do dono foi padronizar.
export default function FichaCabecalho({ tipo, nome }: { tipo: TipoFicha; nome: ReactNode }) {
  return (
    <div className="ficha-topo">
      <div className="ficha-logo">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-chef-hilana-maia.png" alt="Chef Hilana Maia Gastronomia" />
      </div>
      <div className="ficha-faixas">
        <div className="ficha-barra">CHEF HILANA MAIA GASTRONOMIA</div>
        <div className="ficha-barra">{TIPO_FICHA_TITULO[tipo]}</div>
        <div className="ficha-barra ficha-barra-nome">{nome}</div>
      </div>
    </div>
  )
}
