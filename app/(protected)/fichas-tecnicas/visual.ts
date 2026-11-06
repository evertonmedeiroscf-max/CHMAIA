import type { FichaTecnica, FichaTecnicaIngrediente, ItemEstoqueFicha } from '@/lib/types/domain'
import { pesoBruto, precoUnitario, type ResumoFicha } from '@/lib/utils/fichaTecnica'

// Texto que marca a linha cujo ingrediente a importação não conseguiu associar com clareza.
export const TEXTO_SEM_ORIGEM = 'NÃO CONSEGUIU OBTER INFORMAÇÃO DO ARQUIVO'

// Linha de ingrediente já "resolvida" para mostrar na ficha (nome, unidade,
// preço do kg e preço unit vindos do Estoque ou da ficha de Base).
export type LinhaVisual = {
  id: string
  ordem: number
  semOrigem: boolean
  nome: string | null
  // Se o ingrediente é uma ficha de Base: id dela (a tela faz o link).
  fichaBaseId: string | null
  // Nome que estava no arquivo de origem e motivo de não ter sido associado.
  origem: string | null
  motivo: string | null
  unidade: string
  observacao: string | null
  pesoLiquido: number | null
  fc: number | null
  pesoBruto: number | null
  precoKg: number | null
  precoUnit: number | null
  medida: string | null
  // O preço vem de uma Base que tem linhas incompletas (custo parcial).
  parcial: boolean
}

export function montarLinhasVisuais(
  fichaId: string,
  linhas: FichaTecnicaIngrediente[],
  itens: ItemEstoqueFicha[],
  fichas: FichaTecnica[],
  resumos: Map<string, ResumoFicha>
): LinhaVisual[] {
  const itemPorId = new Map(itens.map((i) => [i.id, i]))
  const fichaPorId = new Map(fichas.map((f) => [f.id, f]))
  return linhas
    .filter((l) => l.ficha_id === fichaId)
    .sort((a, b) => a.ordem - b.ordem)
    .map((l) => {
      let nome: string | null = null
      let unidade = ''
      let precoKg: number | null = null
      let fichaBaseId: string | null = null
      let parcial = false

      if (!l.sem_origem && l.estoque_item_id) {
        const item = itemPorId.get(l.estoque_item_id)
        nome = item?.nome ?? null
        unidade = item?.unidade_medida ?? ''
        precoKg = item?.preco_corrente ?? null
      } else if (!l.sem_origem && l.ficha_ingrediente_id) {
        const base = fichaPorId.get(l.ficha_ingrediente_id)
        const resumo = resumos.get(l.ficha_ingrediente_id)
        nome = base?.nome ?? null
        fichaBaseId = base?.id ?? null
        unidade = 'KG'
        precoKg = resumo?.custoKg ?? null
        parcial = !!resumo && resumo.incompletas > 0
      }

      const calculo = { peso_liquido: l.peso_liquido, fc: l.fc, preco_kg: precoKg }
      return {
        id: l.id,
        ordem: l.ordem,
        semOrigem: l.sem_origem,
        nome,
        fichaBaseId,
        origem: l.ingrediente_origem,
        motivo: l.sem_origem_motivo,
        unidade,
        observacao: l.observacao,
        pesoLiquido: l.peso_liquido,
        fc: l.fc,
        pesoBruto: pesoBruto(calculo),
        precoKg,
        precoUnit: precoUnitario(calculo),
        medida: l.medida_caseira,
        parcial,
      }
    })
}
