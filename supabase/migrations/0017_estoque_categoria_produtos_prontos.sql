-- Adiciona "Produtos Prontos" (pratos já preparados) como 7ª categoria de
-- estoque, pedida pela planilha de controle real do usuário — só amplia a
-- lista de valores permitidos, não muda nenhuma regra de cálculo.
alter table estoque_itens drop constraint estoque_itens_categoria_check;
alter table estoque_itens add constraint estoque_itens_categoria_check check (
  categoria in ('Frios e Laticínios', 'Bebidas', 'Hortifruti', 'Mercearia', 'Proteínas', 'Embalagens', 'Produtos Prontos')
);
