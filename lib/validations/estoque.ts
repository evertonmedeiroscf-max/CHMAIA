import { z } from 'zod'
import { TIPOS_MOVIMENTO, UNIDADES_MEDIDA } from '@/lib/types/domain'
import { limparNomeCategoria } from '@/lib/utils/categoriasEstoque'

// nome/marca_fornecedor sempre gravados em maiúsculas, não importa como o
// usuário digitou — padroniza a exibição na tabela e evita duas linhas pro
// mesmo item só por causa de caixa diferente ("Bacon" vs "bacon").
// quantidade_atual pode ser digitada tanto na criação (estoque inicial)
// quanto na edição — nesse segundo caso a action não grava o valor direto:
// ela calcula a diferença e registra um movimento de ajuste (ver
// updateEstoqueItem em actions.ts), pra quantidade_atual continuar sempre
// derivada da soma dos movimentos (mesma garantia do trigger do banco).
export const estoqueItemSchema = z.object({
  nome: z.string().trim().toUpperCase().min(1, 'Informe o nome do item'),
  // Texto livre: pode ser uma das 7 de sempre ou uma categoria nova digitada no formulário.
  categoria: z
    .string()
    .transform(limparNomeCategoria)
    .pipe(z.string().min(1, 'Informe a categoria').max(60, 'A categoria pode ter no máximo 60 caracteres')),
  unidade_medida: z.enum(UNIDADES_MEDIDA),
  preco_corrente: z.coerce.number().nonnegative('Preço não pode ser negativo').nullable().optional(),
  // FC em branco fica null (o sistema nunca assume 1); se preenchido, > 0.
  fc: z.coerce.number().positive('O FC deve ser maior que zero').nullable().optional(),
  custo_unidade: z.coerce.number().nonnegative('Custo não pode ser negativo').nullable().optional(),
  marca_fornecedor: z.string().trim().toUpperCase().nullable().optional(),
  // Texto livre (do jeito que foi digitado); em branco vira null.
  observacao: z
    .string()
    .trim()
    .max(500, 'A observação pode ter no máximo 500 caracteres')
    .nullable()
    .optional()
    .transform((v) => (v ? v : null)),
  quantidade_atual: z.coerce.number().nonnegative('Quantidade atual não pode ser negativa'),
  quantidade_minima: z.coerce.number().nonnegative('Quantidade mínima não pode ser negativa'),
})

export const estoqueMovimentoSchema = z.object({
  tipo: z.enum(TIPOS_MOVIMENTO),
  quantidade: z.coerce.number().positive('Quantidade deve ser maior que zero'),
  data: z.string().min(1, 'Informe a data'),
  motivo: z.string().nullable().optional(),
})

export type EstoqueItemFormValues = z.infer<typeof estoqueItemSchema>
export type EstoqueMovimentoFormValues = z.infer<typeof estoqueMovimentoSchema>
