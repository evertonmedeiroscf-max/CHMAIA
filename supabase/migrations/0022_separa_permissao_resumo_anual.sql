-- Separa a permissão única 'dashboard' (que cobria Resumo financeiro
-- mensal E anual de uma vez) em duas chaves independentes: 'dashboard'
-- (mensal, nome mantido por compatibilidade) e 'resumo-anual' (anual). Um
-- ADM passa a poder liberar uma tela sem a outra (ver PAGINAS_SISTEMA em
-- lib/types/domain.ts).
--
-- As duas telas leem os mesmos dados (pedidos + despesas), então as
-- policies de SELECT dessas tabelas passam a aceitar QUALQUER uma das duas
-- chaves — sem isso, um usuário com só 'resumo-anual' (sem 'dashboard')
-- passaria pela checagem de página em exigirAcesso() mas veria a tela do
-- Resumo anual vazia, barrado pelo RLS.
drop policy "pedidos_select_acesso" on pedidos;
create policy "pedidos_select_acesso" on pedidos
  for select to authenticated using (usuario_tem_acesso(array['pedidos','notas-fiscais','dashboard','resumo-anual']));

drop policy "despesas_select_acesso" on despesas;
create policy "despesas_select_acesso" on despesas
  for select to authenticated using (usuario_tem_acesso(array['despesas','dashboard','resumo-anual']));

-- Novo padrão de páginas pra usuários criados a partir de agora.
alter table usuarios alter column paginas set default array['dashboard','resumo-anual','orcamentos','produtos','pedidos','notas-fiscais','despesas','estoque'];

-- Quem já tinha 'dashboard' (que antes dava acesso às duas telas) continua
-- com as duas — sem isso, a separação revogaria silenciosamente o acesso
-- ao Resumo anual de todo mundo que já usava o sistema.
update usuarios set paginas = array_append(paginas, 'resumo-anual')
where 'dashboard' = any(paginas) and not ('resumo-anual' = any(paginas));
