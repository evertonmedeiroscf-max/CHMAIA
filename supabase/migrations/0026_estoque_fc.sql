-- Estoque ganha o FC (fator de correção), vindo da coluna FC da aba
-- INVENTÁRIO MASTER da planilha de fichas técnicas.
--
-- fc fica NULL quando não há valor: o sistema nunca assume FC = 1 por conta
-- própria. fc_sem_origem = true marca o item cujo FC NÃO foi obtido com
-- clareza do arquivo de origem na importação (item que não existe na
-- planilha, nome repetido com FC diferente, nome que só difere na
-- acentuação...) — a tela realça esses itens. Ao digitar um FC manualmente
-- na edição do item, a marca é desligada (ver updateEstoqueItem).
alter table estoque_itens
  add column if not exists fc numeric(12,6) check (fc is null or fc > 0),
  add column if not exists fc_sem_origem boolean not null default false;
