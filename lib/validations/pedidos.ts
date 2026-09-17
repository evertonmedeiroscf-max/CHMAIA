import { z } from 'zod'
import { ENTIDADE_TIPOS, FORMAS_PAGAMENTO, STATUS_PEDIDO } from '@/lib/types/domain'

export const pedidoSchema = z
  .object({
    data_venda: z.string().min(1, 'Informe a data da venda'),
    data_evento: z.string().nullable().optional(),
    cliente: z.string().min(1, 'Informe o cliente'),
    valor_total: z.coerce.number().positive('Valor total deve ser maior que zero'),
    valor_pago: z.coerce.number().nonnegative('Valor pago não pode ser negativo'),
    entidade: z.enum(ENTIDADE_TIPOS),
    emissao_nota: z.boolean(),
    forma_pagamento: z.enum(FORMAS_PAGAMENTO).nullable().optional(),
    banco: z.string().nullable().optional(),
    data_pagamento: z.string().nullable().optional(),
    status: z.enum(STATUS_PEDIDO),
  })
  .refine((data) => data.valor_pago <= data.valor_total, {
    message: 'Valor pago não pode ser maior que o valor total',
    path: ['valor_pago'],
  })

export type PedidoFormValues = z.infer<typeof pedidoSchema>
