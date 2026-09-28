-- Observação livre do produto (ex.: "Mínimo de 20 unidades", "Serve 10
-- pessoas", "Preço por unidade") — veio da coluna Observação da planilha
-- do cardápio importada para o catálogo.
alter table produtos add column if not exists observacao text;
