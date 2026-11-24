-- Categorias do Estoque deixam de ser uma lista fixa de 7: o usuário passa a poder criar
-- categorias novas ao cadastrar/editar um item (opção "+ Nova categoria…" do formulário).
-- A trava antiga só aceitava as 7 categorias de sempre; troca por "texto não vazio".
-- Nada muda nos itens que já existem. A lista que aparece na tela é calculada a partir dos
-- itens (ver lib/utils/categoriasEstoque.ts), então não há tabela de categorias para manter.
alter table estoque_itens drop constraint estoque_itens_categoria_check;
alter table estoque_itens add constraint estoque_itens_categoria_check check (length(btrim(categoria)) > 0);
