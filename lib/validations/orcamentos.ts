import { z } from 'zod'
import { ENTIDADE_TIPOS, STATUS_ORCAMENTO } from '@/lib/types/domain'

const itemOrcamentoSchema = z.object({
  nome: z.string().min(1, 'Informe o nome do item'),
  peso_kg: z.number().nullable(),
  valor_unit: z.number().nonnegative('Valor unitário não pode ser negativo'),
  quantidade: z.number().nonnegative('Quantidade não pode ser negativa'),
  observacao: z.string().nullable().optional(),
})

const secaoOrcamentoSchema = z.object({
  nome: z.string().min(1, 'Informe o nome da seção'),
  tipo: z.enum(['comida', 'servico']),
  itens: z.array(itemOrcamentoSchema),
})

export const orcamentoSchema = z.object({
  data_orcamento: z.string().min(1, 'Informe a data do orçamento'),
  cliente: z.string().min(1, 'Informe o cliente'),
  entidade: z.enum(ENTIDADE_TIPOS),
  data_evento: z.string().nullable().optional(),
  hora_evento: z.string().nullable().optional(),
  descricao: z.string().nullable().optional(),
  // Pode ser 0: o orçamento é salvo primeiro só com os dados do cliente.
  valor_total: z.coerce.number().nonnegative('Valor não pode ser negativo').default(0),
  validade: z.string().nullable().optional(),
  status: z.enum(STATUS_ORCAMENTO),
  numero_pessoas: z.coerce.number().int().positive().nullable().optional(),
  percentual_extras: z.coerce.number().nonnegative('Percentual não pode ser negativo').default(0),
  itens: z.array(secaoOrcamentoSchema).default([]),
})

export type OrcamentoFormValues = z.infer<typeof orcamentoSchema>
