import { exigirAcesso } from '@/lib/supabase/acesso'
import type { FichaTecnica } from '@/lib/types/domain'
import { calcularFicha } from '@/lib/utils/fichaTecnica'
import { carregarItensEstoque, carregarLinhasIngredientes, type LinhaResumo } from './dados'
import FichasTecnicasClient, { type FichaListada } from './FichasTecnicasClient'

export default async function FichasTecnicasPage() {
  const supabase = await exigirAcesso('fichas-tecnicas')

  const { data: fichas, error } = await supabase.from('fichas_tecnicas').select('*').order('nome')
  if (error) {
    return <p className="form-error">Erro ao carregar as fichas técnicas: {error.message}</p>
  }

  const [linhas, itens] = await Promise.all([carregarLinhasIngredientes(supabase), carregarItensEstoque(supabase)])

  const precoPorItem = new Map(itens.map((i) => [i.id, i.preco_corrente]))
  const linhasPorFicha = new Map<string, LinhaResumo[]>()
  for (const linha of linhas) {
    const lista = linhasPorFicha.get(linha.ficha_id) ?? []
    lista.push(linha)
    linhasPorFicha.set(linha.ficha_id, lista)
  }

  const lista: FichaListada[] = ((fichas ?? []) as FichaTecnica[]).map((ficha) => {
    const doGrupo = linhasPorFicha.get(ficha.id) ?? []
    const resumo = calcularFicha(
      doGrupo.map((l) => ({
        peso_liquido: l.peso_liquido,
        fc: l.fc,
        preco_kg: precoPorItem.get(l.estoque_item_id) ?? null,
      })),
      ficha.rendimento_kg
    )
    return {
      id: ficha.id,
      nome: ficha.nome,
      rendimento_kg: ficha.rendimento_kg,
      data_atualizacao: ficha.data_atualizacao,
      ingredientes: doGrupo.length,
      custo_total: resumo.custoTotal,
      custo_kg: resumo.custoKg,
      sem_preco: resumo.semPreco,
    }
  })

  return <FichasTecnicasClient fichas={lista} />
}
