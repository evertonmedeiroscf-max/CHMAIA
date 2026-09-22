import { z } from 'zod'
import { TIPOS_PRODUTO } from '@/lib/types/domain'

export const produtoSchema = z.object({
  nome: z.string().min(1, 'Informe o nome do produto'),
  tipo: z.enum(TIPOS_PRODUTO),
  categoria: z.string().nullable().optional(),
  peso_kg_padrao: z.coerce.number().nonnegative('Peso não pode ser negativo').nullable().optional(),
  valor_unit_padrao: z.coerce.number().nonnegative('Valor não pode ser negativo'),
  ativo: z.boolean(),
})

export type ProdutoFormValues = z.infer<typeof produtoSchema>
