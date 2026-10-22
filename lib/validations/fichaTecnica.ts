import { z } from 'zod'

const textoOpcional = z
  .string()
  .nullable()
  .optional()
  .transform((v) => (v && v.trim() ? v.trim() : null))

export const MAX_INGREDIENTES_FICHA = 40

export const fichaTecnicaSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome da ficha'),
  rendimento_kg: z.coerce.number({ invalid_type_error: 'Informe o rendimento' }).positive('O rendimento deve ser maior que zero'),
  data_atualizacao: z
    .string()
    .nullable()
    .optional()
    .transform((v) => (v && v.trim() ? v.trim() : null))
    .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), 'Data de atualização inválida'),
  modo_preparo: textoOpcional,
  ingredientes: z
    .array(
      z.object({
        // id da linha já gravada (edição); ausente = linha nova.
        id: z.string().uuid().nullable().optional(),
        estoque_item_id: z.string().uuid('Escolha o ingrediente em todas as linhas'),
        observacao: textoOpcional,
        peso_liquido: z.coerce.number({ invalid_type_error: 'Informe o peso líquido' }).nonnegative('O peso líquido não pode ser negativo'),
        fc: z.coerce.number({ invalid_type_error: 'Informe o FC' }).positive('O FC deve ser maior que zero'),
        medida_caseira: textoOpcional,
      })
    )
    .min(1, 'Adicione pelo menos um ingrediente')
    .max(MAX_INGREDIENTES_FICHA, `No máximo ${MAX_INGREDIENTES_FICHA} ingredientes por ficha`),
})

export type FichaTecnicaFormValues = z.infer<typeof fichaTecnicaSchema>
