-- Notas de compra: comprovante de compra (nota fiscal, recibo, cupom, print)
-- lido por IA em duas etapas, cada uma na sua aba:
--
-- 1) Despesas: aprovar a nota grava a despesa geral (valor/data/categoria).
--    Não mexe em estoque.
-- 2) Estoque: com a despesa já aprovada, o gerente de estoque confere item a
--    item e confirma — só aí um movimento de entrada real é criado.
--
-- Por isso `notas_compra`/`notas_compra_itens` (e o bucket) são visíveis por
-- QUALQUER UMA das duas permissões ('despesas' OU 'estoque'), mas nenhuma
-- policy existente de estoque_itens/estoque_movimentos muda — a confirmação
-- de item continua exigindo 'estoque', do jeito que já era.

-- ============================================================
-- BUCKET DE STORAGE (comprovantes, privado)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('notas-compra', 'notas-compra', false)
on conflict (id) do nothing;

create policy "notas_compra_storage_select" on storage.objects
  for select to authenticated using (
    bucket_id = 'notas-compra' and usuario_tem_acesso(array['despesas', 'estoque'])
  );
create policy "notas_compra_storage_insert" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'notas-compra' and usuario_tem_acesso(array['despesas'])
  );
create policy "notas_compra_storage_delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'notas-compra' and usuario_tem_acesso(array['despesas'])
  );

-- ============================================================
-- NOTAS_COMPRA
-- ============================================================
create table if not exists notas_compra (
  id uuid primary key default gen_random_uuid(),
  arquivo_path text not null,
  nome_exibicao text,
  mime_type text not null,
  estabelecimento text,
  data_compra date,
  valor_total_lido numeric(12,2),
  status text not null default 'processando' check (
    status in ('processando', 'aguardando_aprovacao', 'aprovada', 'concluida', 'falha_leitura')
  ),
  despesa_id uuid references despesas(id) on delete set null,
  erro_processamento text,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_notas_compra_status on notas_compra (status);

create trigger trg_notas_compra_updated_at
before update on notas_compra
for each row execute function set_updated_at();

alter table notas_compra enable row level security;

create policy "notas_compra_select_acesso" on notas_compra
  for select to authenticated using (usuario_tem_acesso(array['despesas', 'estoque']));
create policy "notas_compra_insert_acesso" on notas_compra
  for insert to authenticated with check (usuario_tem_acesso(array['despesas', 'estoque']));
create policy "notas_compra_update_acesso" on notas_compra
  for update to authenticated using (usuario_tem_acesso(array['despesas', 'estoque']))
  with check (usuario_tem_acesso(array['despesas', 'estoque']));
create policy "notas_compra_delete_acesso" on notas_compra
  for delete to authenticated using (usuario_tem_acesso(array['despesas', 'estoque']));

create trigger trg_historico_notas_compra
after insert or update or delete on notas_compra
for each row execute function registrar_historico();

-- ============================================================
-- NOTAS_COMPRA_ITENS
-- ============================================================
create table if not exists notas_compra_itens (
  id uuid primary key default gen_random_uuid(),
  nota_id uuid not null references notas_compra(id) on delete cascade,
  texto_original text not null,
  estoque_item_id uuid references estoque_itens(id) on delete set null,
  quantidade numeric(12,3) not null check (quantidade > 0),
  valor_total numeric(12,2) not null check (valor_total >= 0),
  confianca numeric(3,2),
  validado boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_notas_compra_itens_nota on notas_compra_itens (nota_id);

alter table notas_compra_itens enable row level security;

create policy "notas_compra_itens_select_acesso" on notas_compra_itens
  for select to authenticated using (usuario_tem_acesso(array['despesas', 'estoque']));
create policy "notas_compra_itens_insert_acesso" on notas_compra_itens
  for insert to authenticated with check (usuario_tem_acesso(array['despesas', 'estoque']));
create policy "notas_compra_itens_update_acesso" on notas_compra_itens
  for update to authenticated using (usuario_tem_acesso(array['despesas', 'estoque']))
  with check (usuario_tem_acesso(array['despesas', 'estoque']));
create policy "notas_compra_itens_delete_acesso" on notas_compra_itens
  for delete to authenticated using (usuario_tem_acesso(array['despesas', 'estoque']));

-- ============================================================
-- ESTOQUE_APELIDOS — aprendizado de "texto da nota" -> item de estoque,
-- só usado a partir da tela de Estoque.
-- ============================================================
create table if not exists estoque_apelidos (
  id uuid primary key default gen_random_uuid(),
  estoque_item_id uuid not null references estoque_itens(id) on delete cascade,
  texto_normalizado text not null unique,
  created_at timestamptz not null default now()
);

alter table estoque_apelidos enable row level security;

create policy "estoque_apelidos_select_acesso" on estoque_apelidos
  for select to authenticated using (usuario_tem_acesso(array['estoque']));
create policy "estoque_apelidos_insert_acesso" on estoque_apelidos
  for insert to authenticated with check (usuario_tem_acesso(array['estoque']));
create policy "estoque_apelidos_update_acesso" on estoque_apelidos
  for update to authenticated using (usuario_tem_acesso(array['estoque']))
  with check (usuario_tem_acesso(array['estoque']));
create policy "estoque_apelidos_delete_acesso" on estoque_apelidos
  for delete to authenticated using (usuario_tem_acesso(array['estoque']));

-- ============================================================
-- ESTOQUE_MOVIMENTOS ganha o vínculo com o item da nota que o gerou.
-- O índice único parcial é a trava real contra duplo-clique/duplicidade:
-- não importa de qual camada vem o insert, o banco nunca deixa o mesmo
-- item de nota gerar dois movimentos.
-- ============================================================
alter table estoque_movimentos
  add column if not exists nota_item_id uuid references notas_compra_itens(id) on delete set null;

create unique index if not exists idx_estoque_movimentos_nota_item_unico
  on estoque_movimentos (nota_item_id)
  where nota_item_id is not null;
