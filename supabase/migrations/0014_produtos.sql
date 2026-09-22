-- Catálogo de produtos/itens de cardápio e serviço, reaproveitável ao
-- montar um Orçamento (ver seletor "do catálogo" em OrcamentoItensEditor)
-- em vez de digitar nome/peso/valor do zero toda vez. `tipo` espelha o
-- mesmo campo de SecaoOrcamento (comida tem peso, serviço não).
create table if not exists produtos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo text not null default 'comida' check (tipo in ('comida', 'servico')),
  categoria text,
  peso_kg_padrao numeric(12,3),
  valor_unit_padrao numeric(12,2) not null default 0 check (valor_unit_padrao >= 0),
  ativo boolean not null default true,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_produtos_categoria on produtos (categoria);
create index if not exists idx_produtos_tipo on produtos (tipo);

create trigger trg_produtos_updated_at
before update on produtos
for each row execute function set_updated_at();

alter table produtos enable row level security;

-- Leitura liberada pra quem mexe em Orçamentos também (precisa do catálogo
-- pra montar os itens), mas só quem tem a aba Produtos gerencia o cadastro.
create policy "produtos_select_acesso" on produtos
  for select to authenticated using (usuario_tem_acesso(array['produtos', 'orcamentos']));
create policy "produtos_insert_acesso" on produtos
  for insert to authenticated with check (usuario_tem_acesso(array['produtos']));
create policy "produtos_update_acesso" on produtos
  for update to authenticated using (usuario_tem_acesso(array['produtos'])) with check (usuario_tem_acesso(array['produtos']));
create policy "produtos_delete_acesso" on produtos
  for delete to authenticated using (usuario_tem_acesso(array['produtos']));

alter table usuarios alter column paginas set default array['dashboard','orcamentos','produtos','pedidos','notas-fiscais','despesas','estoque'];
