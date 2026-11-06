import { z } from 'zod'
import { TIPOS_FICHA } from '@/lib/types/domain'

const textoOpcional = z
  .string()
  .nullable()
  .optional()
  .transform((v) => (v && v.trim() ? v.trim() : null))

// Número opcional: '' / null / ausente = null (o sistema nunca assume um valor).
function numeroOpcional(mensagemInvalido: string) {
  return z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? null : v),
    z.coerce.number({ invalid_type_error: mensagemInvalido }).nullable()
  )
}

export const MAX_INGREDIENTES_FICHA = 40

const linhaSchema = z
  .object({
    // id da linha já gravada (edição); ausente = linha nova.
    id: z.string().uuid().nullable().optional(),
    // Cada linha aponta para UM item do Estoque OU UMA ficha de Base — ou, se a
    // importação não conseguiu associar, nenhum dos dois (sem_origem).
    estoque_item_id: z.string().uuid().nullable().optional(),
    ficha_ingrediente_id: z.string().uuid().nullable().optional(),
    ingrediente_origem: textoOpcional,
    sem_origem: z.boolean().optional(),
    sem_origem_motivo: textoOpcional,
    observacao: textoOpcional,
    peso_liquido: numeroOpcional('Peso líquido inválido').pipe(z.number().nonnegative('O peso líquido não pode ser negativo').nullable()),
    fc: numeroOpcional('FC inválido').pipe(z.number().positive('O FC deve ser maior que zero').nullable()),
    medida_caseira: textoOpcional,
  })
  .superRefine((linha, ctx) => {
    const temItem = !!linha.estoque_item_id
    const temFicha = !!linha.ficha_ingrediente_id
    if (temItem && temFicha) {
      ctx.addIssue({ code: 'custom', message: 'Cada linha usa um item do Estoque OU uma ficha de Base, não os dois' })
    }
    if (!temItem && !temFicha && !linha.sem_origem) {
      ctx.addIssue({ code: 'custom', message: 'Escolha o ingrediente em todas as linhas' })
    }
  })
  // Ingrediente escolhido = a pendência "sem origem" está resolvida.
  .transform((linha) => {
    const resolvida = !!linha.estoque_item_id || !!linha.ficha_ingrediente_id
    return {
      ...linha,
      estoque_item_id: linha.estoque_item_id ?? null,
      ficha_ingrediente_id: linha.ficha_ingrediente_id ?? null,
      sem_origem: resolvida ? false : true,
      sem_origem_motivo: resolvida ? null : (linha.sem_origem_motivo ?? null),
    }
  })

export const fichaTecnicaSchema = z
  .object({
    tipo: z.enum(TIPOS_FICHA),
    nome: z.string().trim().min(1, 'Informe o nome da ficha'),
    // BASE: obrigatório (> 0). FINALIZAÇÃO: não usa rendimento.
    rendimento_kg: numeroOpcional('Rendimento inválido').pipe(z.number().positive('O rendimento deve ser maior que zero').nullable()),
    markup: numeroOpcional('Markup inválido').pipe(z.number().nonnegative('O markup não pode ser negativo').nullable()),
    serve: numeroOpcional('Serve inválido').pipe(z.number().positive('"Serve" deve ser maior que zero').nullable()),
    data_atualizacao: z
      .string()
      .nullable()
      .optional()
      .transform((v) => (v && v.trim() ? v.trim() : null))
      .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), 'Data de atualização inválida'),
    modo_preparo: textoOpcional,
    ingredientes: z
      .array(linhaSchema)
      .min(1, 'Adicione pelo menos um ingrediente')
      .max(MAX_INGREDIENTES_FICHA, `No máximo ${MAX_INGREDIENTES_FICHA} ingredientes por ficha`),
  })
  .superRefine((ficha, ctx) => {
    if (ficha.tipo === 'bases' && ficha.rendimento_kg === null) {
      ctx.addIssue({ code: 'custom', path: ['rendimento_kg'], message: 'Informe o rendimento' })
    }
  })

export type FichaTecnicaFormValues = z.infer<typeof fichaTecnicaSchema>
