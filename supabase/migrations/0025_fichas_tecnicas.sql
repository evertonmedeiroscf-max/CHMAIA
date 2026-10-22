-- Fichas técnicas (aba "Fichas técnicas"): primeiro tipo é "FICHA TÉCNICA DE
-- PREPARO - BASES", espelho da planilha de fichas técnicas (aba PADRÃO BASE).
--
-- Cada ficha tem nome, rendimento (kg), data de atualização e modo de
-- preparo; cada linha de ingrediente aponta para um item do ESTOQUE (de onde
-- vêm a unidade e o "Preço do Kg" = preco_corrente) e guarda o que é próprio
-- da receita: observação, peso líquido, FC e medida caseira. Peso bruto
-- (= peso líquido x FC), preço unitário (= preço do kg x FC x peso líquido),
-- custo total e custo do kg são sempre calculados na leitura, nunca gravados
-- — assim acompanham os preços do Estoque.

-- ============================================================
-- FICHAS_TECNICAS
-- ============================================================
create table if not exists fichas_tecnicas (
  id uuid primary key default gen_random_uuid(),
  tipo text not null default 'bases' check (tipo in ('bases')),
  nome text not null,
  rendimento_kg numeric(14,4) not null check (rendimento_kg > 0),
  data_atualizacao date,
  modo_preparo text,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_fichas_tecnicas_updated_at
before update on fichas_tecnicas
for each row execute function set_updated_at();

alter table fichas_tecnicas enable row level security;

create policy "fichas_tecnicas_select_acesso" on fichas_tecnicas
  for select to authenticated using (usuario_tem_acesso(array['fichas-tecnicas']));
create policy "fichas_tecnicas_insert_acesso" on fichas_tecnicas
  for insert to authenticated with check (usuario_tem_acesso(array['fichas-tecnicas']));
create policy "fichas_tecnicas_update_acesso" on fichas_tecnicas
  for update to authenticated using (usuario_tem_acesso(array['fichas-tecnicas']))
  with check (usuario_tem_acesso(array['fichas-tecnicas']));
create policy "fichas_tecnicas_delete_acesso" on fichas_tecnicas
  for delete to authenticated using (usuario_tem_acesso(array['fichas-tecnicas']));

-- Só a ficha (pai) entra no Histórico, igual a orçamentos x itens.
create trigger trg_historico_fichas_tecnicas
after insert or update or delete on fichas_tecnicas
for each row execute function registrar_historico();

-- ============================================================
-- FICHAS_TECNICAS_INGREDIENTES
-- ============================================================
-- estoque_item_id é "on delete restrict": apagar do Estoque um item que está
-- numa ficha é barrado (a ficha ficaria com custo errado em silêncio).
create table if not exists fichas_tecnicas_ingredientes (
  id uuid primary key default gen_random_uuid(),
  ficha_id uuid not null references fichas_tecnicas(id) on delete cascade,
  ordem integer not null,
  estoque_item_id uuid not null references estoque_itens(id) on delete restrict,
  observacao text,
  peso_liquido numeric(14,6) not null check (peso_liquido >= 0),
  fc numeric(12,6) not null default 1 check (fc > 0),
  medida_caseira text,
  created_at timestamptz not null default now()
);

create index if not exists idx_fichas_tecnicas_ingredientes_ficha
  on fichas_tecnicas_ingredientes (ficha_id, ordem);
create index if not exists idx_fichas_tecnicas_ingredientes_item
  on fichas_tecnicas_ingredientes (estoque_item_id);

alter table fichas_tecnicas_ingredientes enable row level security;

create policy "fichas_tecnicas_ingredientes_select_acesso" on fichas_tecnicas_ingredientes
  for select to authenticated using (usuario_tem_acesso(array['fichas-tecnicas']));
create policy "fichas_tecnicas_ingredientes_insert_acesso" on fichas_tecnicas_ingredientes
  for insert to authenticated with check (usuario_tem_acesso(array['fichas-tecnicas']));
create policy "fichas_tecnicas_ingredientes_update_acesso" on fichas_tecnicas_ingredientes
  for update to authenticated using (usuario_tem_acesso(array['fichas-tecnicas']))
  with check (usuario_tem_acesso(array['fichas-tecnicas']));
create policy "fichas_tecnicas_ingredientes_delete_acesso" on fichas_tecnicas_ingredientes
  for delete to authenticated using (usuario_tem_acesso(array['fichas-tecnicas']));

-- ============================================================
-- ESTOQUE_ITENS passa a ser LEGÍVEL também por quem tem 'fichas-tecnicas'
-- (a ficha lista os itens do Estoque e usa o preço deles). Escrever
-- continua exigindo só 'estoque' — as outras 3 policies não mudam.
-- ============================================================
drop policy "estoque_itens_select_acesso" on estoque_itens;
create policy "estoque_itens_select_acesso" on estoque_itens
  for select to authenticated using (usuario_tem_acesso(array['estoque', 'fichas-tecnicas']));
