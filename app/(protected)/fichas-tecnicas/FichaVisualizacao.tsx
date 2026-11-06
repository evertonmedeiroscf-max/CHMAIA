import Link from 'next/link'
import type { FichaTecnica } from '@/lib/types/domain'
import { formatCurrency, formatDateBR } from '@/lib/utils/format'
import { formatNumero, type ResumoFicha } from '@/lib/utils/fichaTecnica'
import FichaCabecalho from './FichaCabecalho'
import { TEXTO_SEM_ORIGEM, type LinhaVisual } from './visual'

function Resumo({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className="ficha-resumo-linha">
      <span className={destaque ? 'ficha-data-rotulo' : undefined}>{rotulo}</span>
      <span className="ficha-resumo-valor">{valor}</span>
    </div>
  )
}

// Ficha para LEITURA: mesmo layout da planilha (logotipo, faixas vermelhas,
// resumo, tabela de ingredientes e modo de preparo). As linhas que a importação
// não conseguiu associar a um item do Estoque (ou a uma ficha de Base) aparecem
// realçadas, com o campo do ingrediente em branco e o nome do arquivo de
// origem só como referência.
export default function FichaVisualizacao({
  ficha,
  resumo,
  linhas,
}: {
  ficha: FichaTecnica
  resumo: ResumoFicha
  linhas: LinhaVisual[]
}) {
  const ehBase = ficha.tipo === 'bases'
  const semOrigem = linhas.filter((l) => l.semOrigem).length

  return (
    <div>
      <div className="page-header">
        <h1>{ficha.nome}</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link href="/fichas-tecnicas" className="btn-secondary">
            ← Voltar para o índice
          </Link>
          <Link href={`/fichas-tecnicas/${ficha.id}/editar`} className="btn-primary">
            Editar ficha
          </Link>
        </div>
      </div>

      <div className="ficha">
        <FichaCabecalho tipo={ficha.tipo} nome={ficha.nome} />

        <div className="ficha-resumo">
          <Resumo rotulo="DATA ATUALIZAÇÃO:" valor={ficha.data_atualizacao ? formatDateBR(ficha.data_atualizacao) : '-'} destaque />
          {ehBase ? (
            <>
              <Resumo rotulo="Rendimento total da receita" valor={ficha.rendimento_kg !== null ? `${formatNumero(ficha.rendimento_kg, 3)} Kg` : '-'} />
              <Resumo rotulo="Custo total da receita" valor={formatCurrency(resumo.custoTotal)} />
              <Resumo rotulo="Custo do kg" valor={resumo.custoKg !== null ? formatCurrency(resumo.custoKg) : '-'} />
            </>
          ) : (
            <>
              <Resumo rotulo="Custo do prato" valor={formatCurrency(resumo.custoTotal)} />
              <Resumo rotulo="Markup" valor={ficha.markup !== null ? formatNumero(ficha.markup, 2) : '-'} />
              <Resumo rotulo="Preço sugerido" valor={resumo.precoSugerido !== null ? formatCurrency(resumo.precoSugerido) : '-'} />
              <Resumo rotulo="Serve" valor={ficha.serve !== null ? formatNumero(ficha.serve, 0) : '-'} />
              <Resumo rotulo="Peso aproximado" valor={`${formatNumero(resumo.pesoAproximado, 3)} Kg`} />
              <Resumo rotulo="Peso per capita" valor={resumo.pesoPerCapita !== null ? `${formatNumero(resumo.pesoPerCapita, 3)} Kg` : '-'} />
            </>
          )}
        </div>

        {(resumo.incompletas > 0 || semOrigem > 0) && (
          <div className="ficha-aviso-incompleta">
            {semOrigem > 0 && (
              <span>
                {semOrigem === 1 ? '1 linha' : `${semOrigem} linhas`} com {TEXTO_SEM_ORIGEM} (realçadas abaixo).{' '}
              </span>
            )}
            <span>O custo mostrado é parcial: {resumo.incompletas === 1 ? '1 linha ficou' : `${resumo.incompletas} linhas ficaram`} fora da soma.</span>
          </div>
        )}

        <div className="ficha-tabela">
          <div className="ficha-grade ficha-grade-leitura ficha-cab">
            <div>Ingredientes</div>
            <div>Observações</div>
            <div>Unid</div>
            <div>Peso líquido</div>
            <div>FC</div>
            <div>Peso bruto</div>
            <div>Medida caseira</div>
            <div>Preço do Kg</div>
            <div>Preço unit</div>
          </div>

          {linhas.map((l) => (
            <div key={l.id} className={`ficha-grade ficha-grade-leitura ficha-linha${l.semOrigem ? ' ficha-linha-sem-origem' : ''}`}>
              <div className="ficha-ingrediente">
                {l.semOrigem ? (
                  <>
                    <div className="ficha-sem-origem-texto">{TEXTO_SEM_ORIGEM}</div>
                    {l.origem && <div className="ficha-origem-ref">no arquivo: {l.origem}</div>}
                    {l.motivo && <div className="ficha-origem-ref">{l.motivo}</div>}
                  </>
                ) : l.fichaBaseId ? (
                  <>
                    <Link href={`/fichas-tecnicas/${l.fichaBaseId}`} className="ficha-link-nome">
                      {l.nome}
                    </Link>
                    <div className="ficha-origem-ref">ficha de Base</div>
                  </>
                ) : (
                  l.nome
                )}
              </div>
              <div className="ficha-texto-leitura">{l.observacao ?? ''}</div>
              <div className="ficha-calc">{l.unidade}</div>
              <div className="ficha-calc">{l.pesoLiquido !== null ? formatNumero(l.pesoLiquido, 3) : '-'}</div>
              <div className="ficha-calc">{l.fc !== null ? formatNumero(l.fc, 2) : '-'}</div>
              <div className="ficha-calc">{l.pesoBruto !== null ? formatNumero(l.pesoBruto, 3) : '-'}</div>
              <div className="ficha-calc">{l.medida ?? ''}</div>
              <div className="ficha-calc">{l.precoKg !== null ? formatCurrency(l.precoKg) : l.semOrigem ? '' : 'sem preço'}</div>
              <div className="ficha-calc">{l.precoUnit !== null ? formatCurrency(l.precoUnit) : ''}</div>
            </div>
          ))}
          {linhas.length === 0 && <div className="empty-state">Esta ficha não tem ingredientes.</div>}
        </div>

        <div className="ficha-barra">MODO DE PREPARO:</div>
        <div className="ficha-modo-leitura">{ficha.modo_preparo ?? 'Sem modo de preparo cadastrado.'}</div>
      </div>
    </div>
  )
}
