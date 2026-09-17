import { z } from 'zod'

// Venda, valor, valor pago, falta, pago, forma, banco e data de pagamento
// não são editáveis aqui — vêm sempre do pedido vinculado (sincronizados
// pelo trigger `sync_nota_fiscal_from_pedido` no banco). Só número da nota,
// data de emissão e o cancelamento manual são campos desta tela.
export const notaFiscalCreateSchema = z.object({
  pedido_id: z.string().uuid('Selecione a venda'),
  numero_nota: z.string().nullable().optional(),
  data_emissao: z.string().nullable().optional(),
})

export const notaFiscalUpdateSchema = z.object({
  numero_nota: z.string().nullable().optional(),
  data_emissao: z.string().nullable().optional(),
  cancelada: z.boolean(),
})

export type NotaFiscalCreateValues = z.infer<typeof notaFiscalCreateSchema>
export type NotaFiscalUpdateValues = z.infer<typeof notaFiscalUpdateSchema>
