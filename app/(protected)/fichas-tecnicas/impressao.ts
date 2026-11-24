import type { FichaTecnica } from '@/lib/types/domain'
import { formatNumero } from '@/lib/utils/fichaTecnica'
import { colunasGradeFotos, separarFotos, type FotoFicha } from '@/lib/utils/fichaFotos'
import { TEXTO_SEM_ORIGEM, type LinhaVisual } from './visual'

// Impressão RESUMIDA da ficha técnica (uma folha A4), no formato da planilha da cozinha: cabeçalho
// (tipo, nome, última atualização, rendimento), tabela Ingredientes / Peso líquido / Unid /
// Observação e Modo de preparo. Sem custos, FC nem preços.
//
// Aqui só se MONTAM os textos, direto da ficha e das linhas que a tela já mostra — nada é
// recalculado, convertido ou inventado. A mesma ordem, os mesmos valores e unidades da ficha.

export type LinhaImpressao = {
  nome: string
  // Linhas de apoio sob o nome (só quando a importação não associou o ingrediente).
  referencias: string[]
  semOrigem: boolean
  peso: string
  unidade: string
  observacao: string
}

export type FotoImpressao = { url: string; legenda: string }

export type FolhaImpressao = {
  titulo: string
  nome: string
  atualizacao: string
  // Base: Rendimento. Finalização: Serve — as fichas de Finalização não têm rendimento cadastrado.
  resumo: { rotulo: string; valor: string }
  linhas: LinhaImpressao[]
  modoPreparo: string
  // Parte SUPERIOR: produto finalizado (0, 1 ou 2 fotos). Parte INFERIOR: passo a passo, depois do
  // modo de preparo, em grade de `colunasFotos` colunas. Só entram fotos cujo link existe.
  fotosProduto: FotoImpressao[]
  fotosPasso: FotoImpressao[]
  colunasFotos: number
}

// "2024-07-08" -> "08.07.24" (o formato das fichas da cozinha). Sem data: vazio.
export function dataCurtaImpressao(dataIso: string | null): string {
  if (!dataIso) return ''
  const [ano, mes, dia] = dataIso.split('-')
  if (!ano || !mes || !dia) return dataIso
  return `${dia}.${mes}.${ano.slice(-2)}`
}

export function montarFolhaImpressao(ficha: FichaTecnica, linhas: LinhaVisual[], fotos: FotoFicha[] = []): FolhaImpressao {
  const ehBase = ficha.tipo === 'bases'
  const porPosicao = separarFotos(fotos)
  const paraImpressao = (lista: FotoFicha[]): FotoImpressao[] =>
    lista.flatMap((f) => (f.url ? [{ url: f.url, legenda: f.legenda ?? '' }] : []))
  const fotosPasso = paraImpressao(porPosicao.passo)
  return {
    titulo: ehBase ? 'FICHA TÉCNICA - BASE' : 'FICHA TÉCNICA - FINALIZAÇÃO',
    nome: ficha.nome,
    atualizacao: dataCurtaImpressao(ficha.data_atualizacao),
    resumo: ehBase
      ? { rotulo: 'Rendimento', valor: ficha.rendimento_kg !== null ? `${formatNumero(ficha.rendimento_kg, 3)} Kg` : '' }
      : { rotulo: 'Serve', valor: ficha.serve !== null ? formatNumero(ficha.serve, 0) : '' },
    linhas: linhas.map((l) => ({
      nome: l.semOrigem ? TEXTO_SEM_ORIGEM : (l.nome ?? ''),
      referencias: l.semOrigem ? [l.origem ? `no arquivo: ${l.origem}` : '', l.motivo ?? ''].filter(Boolean) : [],
      semOrigem: l.semOrigem,
      peso: l.pesoLiquido !== null ? formatNumero(l.pesoLiquido, 3) : '-',
      unidade: l.unidade,
      observacao: l.observacao ?? '',
    })),
    modoPreparo: ficha.modo_preparo ?? '',
    fotosProduto: paraImpressao(porPosicao.produto),
    fotosPasso,
    colunasFotos: colunasGradeFotos(fotosPasso.length),
  }
}
