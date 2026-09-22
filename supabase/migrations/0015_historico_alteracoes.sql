-- Histórico de alterações: toda criação/edição/exclusão feita por um
-- usuário numa tabela de negócio fica registrada aqui automaticamente
-- (quem, quando, e os dados antes/depois em jsonb — a tela de Histórico
-- calcula o "o que mudou" a partir do antes/depois). A gravação é via
-- trigger em cada tabela, então nenhuma Server Action precisa lembrar de
-- registrar nada, e não tem como escrever no sistema sem deixar rastro.
create table if not exists historico_alteracoes (
  id uuid primary key default gen_random_uuid(),
  tabela text not null,
  registro_id uuid,
  operacao text not null check (operacao in ('insert', 'update', 'delete')),
  dados_antigos jsonb,
  dados_novos jsonb,
  usuario_id uuid references auth.users(id),
  usuario_email text,
  criado_em timestamptz not null default now()
);

create index if not exists idx_historico_criado_em on historico_alteracoes (criado_em desc);
create index if not exists idx_historico_tabela on historico_alteracoes (tabela);
create index if not exists idx_historico_usuario on historico_alteracoes (usuario_id);

alter table historico_alteracoes enable row level security;

-- Só ADM lê o histórico (mesmo padrão de Usuários). Ninguém grava direto —
-- só a trigger abaixo, que roda como dono da função e passa por cima
-- desta RLS pra sempre conseguir inserir o registro.
create policy "historico_select_adm" on historico_alteracoes
  for select to authenticated using (
    exists (select 1 from usuarios where id = auth.uid() and tipo = 'adm' and aprovado)
  );

create or replace function registrar_historico()
returns trigger as $$
declare
  v_usuario_id uuid := auth.uid();
  v_usuario_email text;
begin
  select email into v_usuario_email from usuarios where id = v_usuario_id;

  if (tg_op = 'INSERT') then
    insert into historico_alteracoes (tabela, registro_id, operacao, dados_novos, usuario_id, usuario_email)
    values (tg_table_name, new.id, 'insert', to_jsonb(new), v_usuario_id, v_usuario_email);
    return new;
  elsif (tg_op = 'UPDATE') then
    insert into historico_alteracoes (tabela, registro_id, operacao, dados_antigos, dados_novos, usuario_id, usuario_email)
    values (tg_table_name, new.id, 'update', to_jsonb(old), to_jsonb(new), v_usuario_id, v_usuario_email);
    return new;
  elsif (tg_op = 'DELETE') then
    insert into historico_alteracoes (tabela, registro_id, operacao, dados_antigos, usuario_id, usuario_email)
    values (tg_table_name, old.id, 'delete', to_jsonb(old), v_usuario_id, v_usuario_email);
    return old;
  end if;
  return null;
end;
$$ language plpgsql security definer set search_path = public;

create trigger trg_historico_pedidos
after insert or update or delete on pedidos
for each row execute function registrar_historico();

create trigger trg_historico_despesas
after insert or update or delete on despesas
for each row execute function registrar_historico();

create trigger trg_historico_orcamentos
after insert or update or delete on orcamentos
for each row execute function registrar_historico();

create trigger trg_historico_produtos
after insert or update or delete on produtos
for each row execute function registrar_historico();

create trigger trg_historico_notas_fiscais
after insert or update or delete on notas_fiscais
for each row execute function registrar_historico();

create trigger trg_historico_estoque_itens
after insert or update or delete on estoque_itens
for each row execute function registrar_historico();

create trigger trg_historico_estoque_movimentos
after insert or update or delete on estoque_movimentos
for each row execute function registrar_historico();

create trigger trg_historico_usuarios
after insert or update or delete on usuarios
for each row execute function registrar_historico();
