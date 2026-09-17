-- ============================================================
-- USUÁRIOS DO SISTEMA
-- Cada login do Supabase Auth ganha um espelho aqui. Novo cadastro
-- entra com aprovado=false e fica sem acesso às telas/dados até um
-- usuário já aprovado liberar — ver bloqueio em app/(protected)/layout.tsx
-- e a exigência de usuario_esta_aprovado() nas policies abaixo.
-- ============================================================
create table if not exists usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  aprovado boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_usuarios_updated_at
before update on usuarios
for each row execute function set_updated_at();

alter table usuarios enable row level security;

-- Leitura liberada para qualquer autenticado (mesmo pendente): a própria
-- tela de "aguardando aprovação" precisa ler seu próprio status.
create policy "usuarios_select_authenticated" on usuarios
  for select to authenticated using (true);

-- Só quem já está aprovado pode aprovar/revogar outros — impede que um
-- usuário pendente se autoaprove chamando a API diretamente.
create policy "usuarios_update_aprovados" on usuarios
  for update to authenticated
  using (exists (select 1 from usuarios u where u.id = auth.uid() and u.aprovado))
  with check (true);

-- Helper reaproveitado nas policies das tabelas de negócio abaixo.
create or replace function usuario_esta_aprovado()
returns boolean as $$
  select exists (
    select 1 from usuarios where id = auth.uid() and aprovado
  );
$$ language sql security definer stable set search_path = public;

revoke execute on function usuario_esta_aprovado() from public, anon, authenticated;

-- Cria a linha em usuarios (pendente) sempre que nasce um usuário novo
-- no Supabase Auth. security definer porque o insert em auth.users é
-- feito pelo serviço de auth, fora do contexto RLS do cliente.
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into usuarios (id, email, aprovado)
  values (new.id, new.email, false)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function handle_new_user();

-- Backfill: quem já tinha conta antes dessa migração continua com acesso
-- normal — a exigência de aprovação vale só para cadastros novos daqui pra frente.
insert into usuarios (id, email, aprovado)
select id, email, true from auth.users
on conflict (id) do nothing;

-- ============================================================
-- Passa a exigir aprovação nas tabelas de negócio (antes: using(true)
-- para qualquer authenticated). Sem isso, esconder a aba "Usuários" na
-- interface seria só cosmético — um pendente ainda leria/escreveria
-- dados reais chamando a API do Supabase diretamente.
-- ============================================================

-- PEDIDOS
drop policy "pedidos_select_authenticated" on pedidos;
drop policy "pedidos_insert_authenticated" on pedidos;
drop policy "pedidos_update_authenticated" on pedidos;
drop policy "pedidos_delete_authenticated" on pedidos;

create policy "pedidos_select_aprovado" on pedidos
  for select to authenticated using (usuario_esta_aprovado());
create policy "pedidos_insert_aprovado" on pedidos
  for insert to authenticated with check (usuario_esta_aprovado());
create policy "pedidos_update_aprovado" on pedidos
  for update to authenticated using (usuario_esta_aprovado()) with check (usuario_esta_aprovado());
create policy "pedidos_delete_aprovado" on pedidos
  for delete to authenticated using (usuario_esta_aprovado());

-- DESPESAS
drop policy "despesas_select_authenticated" on despesas;
drop policy "despesas_insert_authenticated" on despesas;
drop policy "despesas_update_authenticated" on despesas;
drop policy "despesas_delete_authenticated" on despesas;

create policy "despesas_select_aprovado" on despesas
  for select to authenticated using (usuario_esta_aprovado());
create policy "despesas_insert_aprovado" on despesas
  for insert to authenticated with check (usuario_esta_aprovado());
create policy "despesas_update_aprovado" on despesas
  for update to authenticated using (usuario_esta_aprovado()) with check (usuario_esta_aprovado());
create policy "despesas_delete_aprovado" on despesas
  for delete to authenticated using (usuario_esta_aprovado());

-- ESTOQUE_ITENS
drop policy "estoque_itens_select_authenticated" on estoque_itens;
drop policy "estoque_itens_insert_authenticated" on estoque_itens;
drop policy "estoque_itens_update_authenticated" on estoque_itens;
drop policy "estoque_itens_delete_authenticated" on estoque_itens;

create policy "estoque_itens_select_aprovado" on estoque_itens
  for select to authenticated using (usuario_esta_aprovado());
create policy "estoque_itens_insert_aprovado" on estoque_itens
  for insert to authenticated with check (usuario_esta_aprovado());
create policy "estoque_itens_update_aprovado" on estoque_itens
  for update to authenticated using (usuario_esta_aprovado()) with check (usuario_esta_aprovado());
create policy "estoque_itens_delete_aprovado" on estoque_itens
  for delete to authenticated using (usuario_esta_aprovado());

-- ESTOQUE_MOVIMENTOS (sem policy de update — livro-razão imutável)
drop policy "estoque_movimentos_select_authenticated" on estoque_movimentos;
drop policy "estoque_movimentos_insert_authenticated" on estoque_movimentos;
drop policy "estoque_movimentos_delete_authenticated" on estoque_movimentos;

create policy "estoque_movimentos_select_aprovado" on estoque_movimentos
  for select to authenticated using (usuario_esta_aprovado());
create policy "estoque_movimentos_insert_aprovado" on estoque_movimentos
  for insert to authenticated with check (usuario_esta_aprovado());
create policy "estoque_movimentos_delete_aprovado" on estoque_movimentos
  for delete to authenticated using (usuario_esta_aprovado());

-- NOTAS_FISCAIS
drop policy "notas_fiscais_select_authenticated" on notas_fiscais;
drop policy "notas_fiscais_insert_authenticated" on notas_fiscais;
drop policy "notas_fiscais_update_authenticated" on notas_fiscais;
drop policy "notas_fiscais_delete_authenticated" on notas_fiscais;

create policy "notas_fiscais_select_aprovado" on notas_fiscais
  for select to authenticated using (usuario_esta_aprovado());
create policy "notas_fiscais_insert_aprovado" on notas_fiscais
  for insert to authenticated with check (usuario_esta_aprovado());
create policy "notas_fiscais_update_aprovado" on notas_fiscais
  for update to authenticated using (usuario_esta_aprovado()) with check (usuario_esta_aprovado());
create policy "notas_fiscais_delete_aprovado" on notas_fiscais
  for delete to authenticated using (usuario_esta_aprovado());
