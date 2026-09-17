import { z } from 'zod'
import { CATEGORIAS_ESTOQUE, TIPOS_MOVIMENTO, UNIDADES_MEDIDA } from '@/lib/types/domain'

export const estoqueItemSchema = z.object({
  nome: z.string().min(1, 'Informe o nome do item'),
  categoria: z.enum(CATEGORIAS_ESTOQUE),
  unidade_medida: z.enum(UNIDADES_MEDIDA),
  quantidade_minima: z.coerce.number().nonnegative('Quantidade mínima não pode ser negativa'),
})

// Quantidade atual só é informada na criação (estoque inicial). Depois
// disso, só muda por meio de movimentos de entrada/saída.
export const estoqueItemCreateSchema = estoqueItemSchema.extend({
  quantidade_atual: z.coerce.number().nonnegative('Quantidade atual não pode ser negativa'),
})

export const estoqueMovimentoSchema = z.object({
  tipo: z.enum(TIPOS_MOVIMENTO),
  quantidade: z.coerce.number().positive('Quantidade deve ser maior que zero'),
  data: z.string().min(1, 'Informe a data'),
  motivo: z.string().nullable().optional(),
})

export type EstoqueItemFormValues = z.infer<typeof estoqueItemSchema>
export type EstoqueMovimentoFormValues = z.infer<typeof estoqueMovimentoSchema>
