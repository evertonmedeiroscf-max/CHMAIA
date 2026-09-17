-- Controle de acesso por aba: cada usuário tem uma lista de páginas
-- liberadas. ADM sempre enxerga tudo, independente dessa lista (não dá
-- pra um ADM se autorrestringir sem querer). Padrão = todas as páginas,
-- pra não quebrar ninguém que já tinha acesso.
alter table usuarios add column if not exists paginas text[] not null default array['dashboard','pedidos','notas-fiscais','despesas','estoque'];

create or replace function usuario_tem_acesso(modulos text[])
returns boolean as $$
  select exists (
    select 1 from usuarios
    where id = auth.uid()
      and aprovado
      and (tipo = 'adm' or paginas && modulos)
  );
$$ language sql security definer stable set search_path = public;

-- Mesma pegadinha de sempre: chamada DENTRO de policies de RLS, então
-- authenticated precisa de EXECUTE nela.
revoke execute on function usuario_tem_acesso(text[]) from public, anon;
grant execute on function usuario_tem_acesso(text[]) to authenticated;

-- ============================================================
-- Substitui usuario_esta_aprovado() nas tabelas de negócio por
-- usuario_tem_acesso(), que já engloba a checagem de aprovado + o módulo
-- certo. O mapeamento reflete quais telas realmente leem cada tabela:
-- Resumo financeiro lê pedidos+despesas; Relatório NF lê pedidos+notas.
-- ============================================================

-- PEDIDOS — lido por Pedidos, Relatório NF (join) e Resumo financeiro
drop policy "pedidos_select_aprovado" on pedidos;
drop policy "pedidos_insert_aprovado" on pedidos;
drop policy "pedidos_update_aprovado" on pedidos;
drop policy "pedidos_delete_aprovado" on pedidos;

create policy "pedidos_select_acesso" on pedidos
  for select to authenticated using (usuario_tem_acesso(array['pedidos','notas-fiscais','dashboard']));
create policy "pedidos_insert_acesso" on pedidos
  for insert to authenticated with check (usuario_tem_acesso(array['pedidos']));
create policy "pedidos_update_acesso" on pedidos
  for update to authenticated using (usuario_tem_acesso(array['pedidos'])) with check (usuario_tem_acesso(array['pedidos']));
create policy "pedidos_delete_acesso" on pedidos
  for delete to authenticated using (usuario_tem_acesso(array['pedidos']));

-- DESPESAS — lido por Despesas e Resumo financeiro
drop policy "despesas_select_aprovado" on despesas;
drop policy "despesas_insert_aprovado" on despesas;
drop policy "despesas_update_aprovado" on despesas;
drop policy "despesas_delete_aprovado" on despesas;

create policy "despesas_select_acesso" on despesas
  for select to authenticated using (usuario_tem_acesso(array['despesas','dashboard']));
create policy "despesas_insert_acesso" on despesas
  for insert to authenticated with check (usuario_tem_acesso(array['despesas']));
create policy "despesas_update_acesso" on despesas
  for update to authenticated using (usuario_tem_acesso(array['despesas'])) with check (usuario_tem_acesso(array['despesas']));
create policy "despesas_delete_acesso" on despesas
  for delete to authenticated using (usuario_tem_acesso(array['despesas']));

-- ESTOQUE_ITENS
drop policy "estoque_itens_select_aprovado" on estoque_itens;
drop policy "estoque_itens_insert_aprovado" on estoque_itens;
drop policy "estoque_itens_update_aprovado" on estoque_itens;
drop policy "estoque_itens_delete_aprovado" on estoque_itens;

create policy "estoque_itens_select_acesso" on estoque_itens
  for select to authenticated using (usuario_tem_acesso(array['estoque']));
create policy "estoque_itens_insert_acesso" on estoque_itens
  for insert to authenticated with check (usuario_tem_acesso(array['estoque']));
create policy "estoque_itens_update_acesso" on estoque_itens
  for update to authenticated using (usuario_tem_acesso(array['estoque'])) with check (usuario_tem_acesso(array['estoque']));
create policy "estoque_itens_delete_acesso" on estoque_itens
  for delete to authenticated using (usuario_tem_acesso(array['estoque']));

-- ESTOQUE_MOVIMENTOS
drop policy "estoque_movimentos_select_aprovado" on estoque_movimentos;
drop policy "estoque_movimentos_insert_aprovado" on estoque_movimentos;
drop policy "estoque_movimentos_delete_aprovado" on estoque_movimentos;

create policy "estoque_movimentos_select_acesso" on estoque_movimentos
  for select to authenticated using (usuario_tem_acesso(array['estoque']));
create policy "estoque_movimentos_insert_acesso" on estoque_movimentos
  for insert to authenticated with check (usuario_tem_acesso(array['estoque']));
create policy "estoque_movimentos_delete_acesso" on estoque_movimentos
  for delete to authenticated using (usuario_tem_acesso(array['estoque']));

-- NOTAS_FISCAIS
drop policy "notas_fiscais_select_aprovado" on notas_fiscais;
drop policy "notas_fiscais_insert_aprovado" on notas_fiscais;
drop policy "notas_fiscais_update_aprovado" on notas_fiscais;
drop policy "notas_fiscais_delete_aprovado" on notas_fiscais;

create policy "notas_fiscais_select_acesso" on notas_fiscais
  for select to authenticated using (usuario_tem_acesso(array['notas-fiscais']));
create policy "notas_fiscais_insert_acesso" on notas_fiscais
  for insert to authenticated with check (usuario_tem_acesso(array['notas-fiscais']));
create policy "notas_fiscais_update_acesso" on notas_fiscais
  for update to authenticated using (usuario_tem_acesso(array['notas-fiscais'])) with check (usuario_tem_acesso(array['notas-fiscais']));
create policy "notas_fiscais_delete_acesso" on notas_fiscais
  for delete to authenticated using (usuario_tem_acesso(array['notas-fiscais']));
