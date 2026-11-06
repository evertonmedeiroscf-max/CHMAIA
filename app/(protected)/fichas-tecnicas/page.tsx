import { exigirAcesso } from '@/lib/supabase/acesso'
import { carregarDadosFichas } from './dados'
import FichasTecnicasClient from './FichasTecnicasClient'
import type { FichaListada } from './listagem'

// Montar todas as fichas e custos leva mais que o padrão da Vercel em contas com
// muitos dados; dá folga.
export const maxDuration = 30

export default async function FichasTecnicasPage() {
  const supabase = await exigirAcesso('fichas-tecnicas')

  let dados
  try {
    dados = await carregarDadosFichas(supabase)
  } catch (erro) {
    return <p className="form-error">Erro ao carregar as fichas técnicas: {erro instanceof Error ? erro.message : 'erro desconhecido'}</p>
  }
  const { fichas, linhas, resumos } = dados

  const porFicha = new Map<string, { total: number; semOrigem: number }>()
  for (const l of linhas) {
    const atual = porFicha.get(l.ficha_id) ?? { total: 0, semOrigem: 0 }
    atual.total++
    if (l.sem_origem) atual.semOrigem++
    porFicha.set(l.ficha_id, atual)
  }

  const lista: FichaListada[] = fichas.map((ficha) => {
    const resumo = resumos.get(ficha.id)
    const contagem = porFicha.get(ficha.id) ?? { total: 0, semOrigem: 0 }
    return {
      id: ficha.id,
      nome: ficha.nome,
      tipo: ficha.tipo,
      rendimento_kg: ficha.rendimento_kg,
      data_atualizacao: ficha.data_atualizacao,
      ingredientes: contagem.total,
      custo_total: resumo?.custoTotal ?? 0,
      custo_kg: resumo?.custoKg ?? null,
      incompletas: resumo?.incompletas ?? 0,
      sem_origem: contagem.semOrigem,
    }
  })

  return <FichasTecnicasClient fichas={lista} />
}
