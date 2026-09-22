-- Detalhamento do orçamento em seções e itens (cardápio + serviço), no
-- mesmo formato das planilhas de custo já usadas pelo usuário: cada item
-- tem peso/kg, valor unitário e quantidade; peso total e valor são
-- calculados (peso_kg*quantidade e valor_unit*quantidade). Guardado como
-- jsonb porque é uma lista aninhada editada sempre por inteiro na tela do
-- orçamento — não precisa ser consultada linha a linha por outra tela.
alter table orcamentos add column if not exists numero_pessoas integer check (numero_pessoas is null or numero_pessoas > 0);
alter table orcamentos add column if not exists percentual_extras numeric(5,2) not null default 0 check (percentual_extras >= 0);
alter table orcamentos add column if not exists itens jsonb not null default '[]'::jsonb;
