// Tipos de domínio usados pela aplicação (formulários, filtros, listagens).
// As constantes abaixo são a fonte única da verdade para os valores
// permitidos — usadas tanto na validação (Zod) quanto nos <select>/filtros.

export const ENTIDADE_TIPOS = ['PF', 'PJ'] as const
export type EntidadeTipo = (typeof ENTIDADE_TIPOS)[number]

export const FORMAS_PAGAMENTO = [
  'Pix',
  'Dinheiro',
  'Cartão de débito',
  'Cartão de crédito',
  'Transferência bancária',
  'Boleto',
] as const
export type FormaPagamento = (typeof FORMAS_PAGAMENTO)[number]

export const STATUS_PEDIDO = ['pendente', '50% pago', 'pago'] as const
export type StatusPedido = (typeof STATUS_PEDIDO)[number]

export const CATEGORIAS_DESPESA = [
  'Insumos/Compras',
  'Mão de obra',
  'Transporte',
  'Aluguel/Equipamento',
  'Outras despesas',
] as const
export type CategoriaDespesa = (typeof CATEGORIAS_DESPESA)[number]

export const CATEGORIAS_ESTOQUE = [
  'Frios e Laticínios',
  'Bebidas',
  'Hortifruti',
  'Mercearia',
  'Proteínas',
  'Embalagens',
] as const
export type CategoriaEstoque = (typeof CATEGORIAS_ESTOQUE)[number]

export const UNIDADES_MEDIDA = ['KG', 'L', 'UND', 'CX', 'PCT'] as const
export type UnidadeMedida = (typeof UNIDADES_MEDIDA)[number]

export const TIPOS_MOVIMENTO = ['entrada', 'saida'] as const
export type TipoMovimento = (typeof TIPOS_MOVIMENTO)[number]

export interface Pedido {
  id: string
  numero: number
  data_venda: string
  data_evento: string | null
  cliente: string
  valor_total: number
  valor_pago: number
  falta_pagar: number
  entidade: EntidadeTipo
  emissao_nota: boolean
  forma_pagamento: FormaPagamento | null
  banco: string | null
  data_pagamento: string | null
  status: StatusPedido
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface Despesa {
  id: string
  data: string
  categoria: CategoriaDespesa
  descricao: string
  valor: number
  forma_pagamento: FormaPagamento | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface EstoqueItem {
  id: string
  nome: string
  categoria: CategoriaEstoque
  unidade_medida: UnidadeMedida
  quantidade_atual: number
  quantidade_minima: number
  created_at: string
  updated_at: string
}

export interface EstoqueMovimento {
  id: string
  item_id: string
  tipo: TipoMovimento
  quantidade: number
  data: string
  motivo: string | null
  created_by: string | null
  created_at: string
}

// Rastreia emissão/pagamento da nota fiscal de um pedido — independente do
// status de pagamento do próprio pedido, pois na prática uma nota pode ser
// paga em data/condição diferente da venda que a originou.
//
// O ciclo de vida é automático (trigger `sync_nota_fiscal_from_pedido` no
// banco): quando o pedido tem "emissão de nota" marcada como Sim, uma linha
// aqui é criada automaticamente (copiando venda/valor/pago do pedido) — o
// usuário só preenche número da nota e data de emissão. Se a emissão do
// pedido voltar para Não: a nota é excluída se ainda não tinha número, ou
// marcada como `cancelada` se já tinha (documento fiscal numerado não some
// sozinho). `previsao_pagamento` é sempre `data_emissao + 15 dias`
// (coluna gerada pelo banco, não é editável).
export interface NotaFiscal {
  id: string
  pedido_id: string
  numero_nota: string | null
  valor: number
  valor_pago: number
  falta_pagar: number
  data_emissao: string | null
  previsao_pagamento: string | null
  pago: boolean
  cancelada: boolean
  forma_pagamento: FormaPagamento | null
  banco: string | null
  data_pagamento: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

// Formato usado pela listagem: nota fiscal com os dados do pedido vinculado
// (cliente, número da venda, data da venda) já unidos via join.
export interface NotaFiscalComPedido extends NotaFiscal {
  pedido_numero: number
  pedido_cliente: string
  pedido_data_venda: string
}
