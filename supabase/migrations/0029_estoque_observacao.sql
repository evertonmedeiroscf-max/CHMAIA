-- Campo livre "Observação" no item de estoque (formulário do item, entre a linha de preços e
-- Marca / Fornecedor). Opcional: itens existentes ficam sem observação (null).
alter table estoque_itens add column if not exists observacao text;
