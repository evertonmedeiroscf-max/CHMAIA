-- Lembretes (nota amarela, como o comentário de célula do Excel) nos cabeçalhos da tabela de
-- ingredientes da ficha técnica: Ingredientes, Observações, Unid, Peso líquido, FC, Peso bruto,
-- Medida caseira, Preço do Kg, Preço unit. Um lembrete por coluna, igual para todas as fichas
-- (ex.: "FATOR DE CORREÇÃO" na coluna FC).
--
-- Quem tem acesso à aba Fichas técnicas LÊ os lembretes; só o ADM cria, edita e apaga
-- (usuario_e_adm(), de 0008). A regra fica no banco para valer mesmo que alguém tente gravar
-- por fora da tela.
create table if not exists fichas_lembretes (
  id uuid primary key default gen_random_uuid(),
  coluna text not null unique check (
    coluna in ('ingredientes', 'observacoes', 'unid', 'peso_liquido', 'fc', 'peso_bruto', 'medida_caseira', 'preco_kg', 'preco_unit')
  ),
  texto text not null check (length(btrim(texto)) > 0 and length(texto) <= 500),
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_fichas_lembretes_updated_at
before update on fichas_lembretes
for each row execute function set_updated_at();

alter table fichas_lembretes enable row level security;

create policy "fichas_lembretes_select_acesso" on fichas_lembretes
  for select to authenticated using (usuario_tem_acesso(array['fichas-tecnicas']));
create policy "fichas_lembretes_insert_adm" on fichas_lembretes
  for insert to authenticated with check (usuario_e_adm());
create policy "fichas_lembretes_update_adm" on fichas_lembretes
  for update to authenticated using (usuario_e_adm()) with check (usuario_e_adm());
create policy "fichas_lembretes_delete_adm" on fichas_lembretes
  for delete to authenticated using (usuario_e_adm());

-- Criar/editar/apagar um lembrete aparece no Histórico, como nas outras abas.
create trigger trg_historico_fichas_lembretes
after insert or update or delete on fichas_lembretes
for each row execute function registrar_historico();
