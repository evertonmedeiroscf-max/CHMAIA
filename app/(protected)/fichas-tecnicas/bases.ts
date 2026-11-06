import type { FichaTecnica } from '@/lib/types/domain'
import type { ResumoFicha } from '@/lib/utils/fichaTecnica'
import type { BaseOpcao } from './FichaEditor'

// Fichas de Base que podem ser escolhidas como ingrediente de outra ficha, com o
// custo/kg já calculado (ordem alfabética).
export function opcoesDeBase(fichas: FichaTecnica[], resumos: Map<string, ResumoFicha>): BaseOpcao[] {
  return fichas
    .filter((f) => f.tipo === 'bases')
    .map((f) => {
      const resumo = resumos.get(f.id)
      return { id: f.id, nome: f.nome, custoKg: resumo?.custoKg ?? null, incompleta: !!resumo && resumo.incompletas > 0 }
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}
