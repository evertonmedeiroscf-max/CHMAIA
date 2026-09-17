-- Corrige bug da 0006: usuario_esta_aprovado() é chamada DENTRO das
-- policies de RLS de pedidos/despesas/estoque_itens/estoque_movimentos/
-- notas_fiscais (using/with check). Para essas queries funcionarem, o
-- papel authenticated precisa de permissão para CHAMAR a função — mesmo
-- ela sendo security definer, isso só isenta o CORPO da função de RLS,
-- não a permissão de invocá-la. A 0006 revogou EXECUTE de authenticated
-- copiando o padrão das funções de trigger (que nunca são chamadas por
-- nome pelo cliente, então não precisam dessa permissão), e isso quebrou
-- o acesso a todas as tabelas de negócio para todo mundo.
grant execute on function usuario_esta_aprovado() to authenticated;
