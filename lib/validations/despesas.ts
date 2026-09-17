import { z } from 'zod'
import { CATEGORIAS_DESPESA, FORMAS_PAGAMENTO } from '@/lib/types/domain'

export const despesaSchema = z.object({
  data: z.string().min(1, 'Informe a data'),
  categoria: z.enum(CATEGORIAS_DESPESA),
  descricao: z.string().min(1, 'Informe a descrição'),
  valor: z.coerce.number().positive('Valor deve ser maior que zero'),
  forma_pagamento: z.enum(FORMAS_PAGAMENTO).nullable().optional(),
})

export type DespesaFormValues = z.infer<typeof despesaSchema>
