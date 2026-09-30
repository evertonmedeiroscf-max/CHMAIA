import { z } from 'zod'

// Confirmação de um item de nota de compra na tela de Estoque — o usuário
// escolhe/confirma a qual item do estoque a linha corresponde e ajusta
// quantidade/valor se a IA errou (ver app/(protected)/estoque/notas-compra/actions.ts).
export const confirmarItemNotaCompraSchema = z.object({
  estoque_item_id: z.string().min(1, 'Selecione o item do estoque'),
  quantidade: z.coerce.number().positive('Quantidade deve ser maior que zero'),
  valor_total: z.coerce.number().nonnegative('Valor não pode ser negativo'),
})

export type ConfirmarItemNotaCompraValues = z.infer<typeof confirmarItemNotaCompraSchema>
