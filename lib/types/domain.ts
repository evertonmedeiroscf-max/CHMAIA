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

export const STATUS_ORCAMENTO = ['pendente', 'aprovado', 'recusado'] as const
export type StatusOrcamento = (typeof STATUS_ORCAMENTO)[number]

export const CATEGORIAS_DESPESA = [
  'Aluguel/Equipamento',
  'Despesas pessoais',
  'Insumo Bebidas',
  'Insumo Embalagens',
  'Insumo Frios e Laticínios',
  'Insumo Hortifruti',
  'Insumo Limpeza',
  'Insumo Mercearia',
  'Insumo Proteínas',
  'Insumos/Compras',
  'Mão de obra',
  'Outras despesas',
  'Transporte',
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
  hora_evento: string | null
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

export const TIPOS_PRODUTO = ['comida', 'servico'] as const
export type TipoProduto = (typeof TIPOS_PRODUTO)[number]

// Catálogo reaproveitável ao montar um Orçamento — ver o seletor "do
// catálogo" em OrcamentoItensEditor, que usa peso_kg_padrao/valor_unit_padrao
// pra preencher um novo item sem precisar digitar do zero. `ativo=false`
// aposenta um produto sem apagar o histórico de orçamentos que já o usaram
// (o item fica gravado com os valores da época dentro do orçamento).
export interface Produto {
  id: string
  nome: string
  tipo: TipoProduto
  categoria: string | null
  peso_kg_padrao: number | null
  valor_unit_padrao: number
  ativo: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

// Uma linha da lista de itens de uma seção do orçamento (ex.: um salgado
// dentro de "Mesa Fixa", ou "Hora Chef" dentro de "Serviço"). peso_kg é
// null para itens sem peso (a maioria dos itens de Serviço) — nesse caso a
// coluna "Peso total" não se aplica.
export interface ItemOrcamento {
  nome: string
  peso_kg: number | null
  valor_unit: number
  quantidade: number
}

// Uma seção da planilha de custo (ex.: "Mesa Fixa", "Prato Quente",
// "Serviço") — o nome é livre porque cada evento usa nomes diferentes
// ("Volante", "Prato Principal" etc.). `tipo` só controla se a seção
// mostra as colunas de peso (comida) ou não (serviço).
export interface SecaoOrcamento {
  nome: string
  tipo: 'comida' | 'servico'
  itens: ItemOrcamento[]
}

// Proposta enviada a um cliente em potencial, antes de virar um Pedido
// confirmado. `pedido_id` só é preenchido quando o orçamento é convertido
// (ver converterEmPedido em app/(protected)/orcamentos/actions.ts) — a
// partir daí ele não pode ser convertido de novo.
//
// `itens` é o detalhamento por seções (ver SecaoOrcamento) no formato das
// planilhas de custo do usuário — quando preenchido, `valor_total` é
// recalculado a partir dele no servidor (ver actions.ts), em vez de vir do
// campo digitado no formulário.
export interface Orcamento {
  id: string
  numero: number
  data_orcamento: string
  cliente: string
  entidade: EntidadeTipo
  data_evento: string | null
  hora_evento: string | null
  descricao: string | null
  valor_total: number
  validade: string | null
  status: StatusOrcamento
  pedido_id: string | null
  numero_pessoas: number | null
  percentual_extras: number
  itens: SecaoOrcamento[]
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

// preco_corrente/custo_unidade/marca_fornecedor são digitados pelo usuário.
// valor_total_estoque é sempre calculado pelo banco (custo_unidade ×
// quantidade_atual). data_atualizacao_preco e data_atualizacao_estoque
// também são automáticas — marcadas sozinhas quando o preço/custo ou a
// quantidade mudam (ver triggers em 0016_estoque_colunas_detalhadas.sql) —
// nunca aparecem como campo editável no formulário.
export interface EstoqueItem {
  id: string
  nome: string
  categoria: CategoriaEstoque
  unidade_medida: UnidadeMedida
  preco_corrente: number | null
  custo_unidade: number | null
  data_atualizacao_preco: string | null
  marca_fornecedor: string | null
  quantidade_minima: number
  quantidade_atual: number
  valor_total_estoque: number
  data_atualizacao_estoque: string | null
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

export const OPERACOES_HISTORICO = ['insert', 'update', 'delete'] as const
export type OperacaoHistorico = (typeof OPERACOES_HISTORICO)[number]

// Uma linha do histórico de alterações — gravada automaticamente por
// trigger (ver registrar_historico() em 0015_historico_alteracoes.sql)
// sempre que um usuário cria, edita ou exclui algo em qualquer tabela de
// negócio. dados_antigos/dados_novos são o retrato completo da linha antes
// e depois; a tela de Histórico calcula o "o que mudou" comparando os dois.
export interface HistoricoAlteracao {
  id: string
  tabela: string
  registro_id: string | null
  operacao: OperacaoHistorico
  dados_antigos: Record<string, unknown> | null
  dados_novos: Record<string, unknown> | null
  usuario_id: string | null
  usuario_email: string | null
  criado_em: string
}

export const TIPOS_USUARIO = ['usuario', 'adm'] as const
export type TipoUsuario = (typeof TIPOS_USUARIO)[number]

// Chaves usadas tanto no array `paginas` do usuário quanto no `href` das
// rotas em NavBar — mudar aqui exige atualizar as policies em
// 0009_usuarios_paginas_acesso.sql (usuario_tem_acesso) também.
export const PAGINAS_SISTEMA = [
  { key: 'dashboard', label: 'Resumo financeiro' },
  { key: 'orcamentos', label: 'Orçamentos' },
  { key: 'produtos', label: 'Produtos' },
  { key: 'pedidos', label: 'Pedidos' },
  { key: 'notas-fiscais', label: 'Relatório NF' },
  { key: 'despesas', label: 'Despesas' },
  { key: 'estoque', label: 'Estoque' },
] as const
export type PaginaSistema = (typeof PAGINAS_SISTEMA)[number]['key']

// Espelho de auth.users criado automaticamente (trigger no banco) a cada
// novo cadastro, sempre com aprovado=false. Sem uma linha aprovada aqui,
// o usuário fica preso na tela de espera em (protected)/layout.tsx — e o
// bloqueio vale também no banco (RLS exige usuario_esta_aprovado()), não
// só na interface. Só quem tem tipo='adm' aprova cadastros e define quem
// mais é ADM (RLS exige usuario_e_adm() nas policies de update). `paginas`
// controla quais abas o usuário vê e quais dados ele lê/grava — ADM
// ignora essa lista e sempre tem acesso a tudo (ver usuario_tem_acesso()).
export interface Usuario {
  id: string
  email: string
  aprovado: boolean
  tipo: TipoUsuario
  paginas: string[]
  created_at: string
  updated_at: string
}
