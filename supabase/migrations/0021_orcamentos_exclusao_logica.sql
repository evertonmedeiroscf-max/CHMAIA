-- "Excluir" um orçamento não apaga mais a linha: marca excluido_em e ele
-- continua na lista, realçado em vermelho (dá para restaurar). Orçamento
-- excluído não pode ser convertido em pedido.
alter table orcamentos add column if not exists excluido_em timestamptz;
