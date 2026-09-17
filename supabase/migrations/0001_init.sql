-- ChMaia — schema inicial
-- Módulos: financeiro (pedidos e despesas) e estoque.
-- Fase atual: usuário único por empresa, todos com o mesmo nível de acesso
-- (qualquer usuário autenticado pode ler/escrever). Se no futuro houver
-- múltiplas empresas, adicione uma coluna empresa_id + policy por tenant
-- sem precisar mudar a estrutura das tabelas abaixo.

create extension if not exists pgcrypto;

-- ============================================================
-- Função utilitária: mantém updated_at em dia
-- ============================================================
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ============================================================
-- PEDIDOS
-- ============================================================
create sequence if not exists pedidos_numero_seq;

create table if not exists pedidos (
  id uuid primary key default gen_random_uuid(),
  numero integer not null default nextval('pedidos_numero_seq') unique,
  data_venda date not null,
  data_evento date,
  cliente text not null,
  valor_total numeric(12,2) not null check (valor_total > 0),
  valor_pago numeric(12,2) not null default 0 check (valor_pago >= 0),
  falta_pagar numeric(12,2) generated always as (valor_total - valor_pago) stored,
  entidade text not null check (entidade in ('PF', 'PJ')),
  emissao_nota boolean not null default false,
  forma_pagamento text check (
    forma_pagamento in ('Pix', 'Dinheiro', 'Cartão de débito', 'Cartão de crédito', 'Transferência bancária', 'Boleto')
  ),
  banco text,
  data_pagamento date,
  status text not null default 'pendente' check (status in ('pendente', '50% pago', 'pago')),
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint valor_pago_nao_excede_total check (valor_pago <= valor_total)
);

alter sequence pedidos_numero_seq owned by pedidos.numero;

create index if not exists idx_pedidos_data_venda on pedidos (data_venda);
create index if not exists idx_pedidos_status on pedidos (status);
create index if not exists idx_pedidos_data_pagamento on pedidos (data_pagamento);

create trigger trg_pedidos_updated_at
before update on pedidos
for each row execute function set_updated_at();

alter table pedidos enable row level security;

create policy "pedidos_select_authenticated" on pedidos
  for select to authenticated using (true);
create policy "pedidos_insert_authenticated" on pedidos
  for insert to authenticated with check (true);
create policy "pedidos_update_authenticated" on pedidos
  for update to authenticated using (true) with check (true);
create policy "pedidos_delete_authenticated" on pedidos
  for delete to authenticated using (true);

-- ============================================================
-- DESPESAS
-- ============================================================
create table if not exists despesas (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  categoria text not null check (
    categoria in ('Insumos/Compras', 'Mão de obra', 'Transporte', 'Aluguel/Equipamento', 'Outras despesas')
  ),
  descricao text not null,
  valor numeric(12,2) not null check (valor > 0),
  forma_pagamento text check (
    forma_pagamento in ('Pix', 'Dinheiro', 'Cartão de débito', 'Cartão de crédito', 'Transferência bancária', 'Boleto')
  ),
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_despesas_data on despesas (data);
create index if not exists idx_despesas_categoria on despesas (categoria);

create trigger trg_despesas_updated_at
before update on despesas
for each row execute function set_updated_at();

alter table despesas enable row level security;

create policy "despesas_select_authenticated" on despesas
  for select to authenticated using (true);
create policy "despesas_insert_authenticated" on despesas
  for insert to authenticated with check (true);
create policy "despesas_update_authenticated" on despesas
  for update to authenticated using (true) with check (true);
create policy "despesas_delete_authenticated" on despesas
  for delete to authenticated using (true);

-- ============================================================
-- ESTOQUE — ITENS
-- ============================================================
create table if not exists estoque_itens (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  categoria text not null check (
    categoria in ('Frios e Laticínios', 'Bebidas', 'Hortifruti', 'Mercearia', 'Proteínas', 'Embalagens')
  ),
  unidade_medida text not null check (unidade_medida in ('KG', 'L', 'UND', 'CX', 'PCT')),
  quantidade_atual numeric(12,3) not null default 0 check (quantidade_atual >= 0),
  quantidade_minima numeric(12,3) not null default 0 check (quantidade_minima >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_estoque_itens_categoria on estoque_itens (categoria);

create trigger trg_estoque_itens_updated_at
before update on estoque_itens
for each row execute function set_updated_at();

alter table estoque_itens enable row level security;

create policy "estoque_itens_select_authenticated" on estoque_itens
  for select to authenticated using (true);
create policy "estoque_itens_insert_authenticated" on estoque_itens
  for insert to authenticated with check (true);
create policy "estoque_itens_update_authenticated" on estoque_itens
  for update to authenticated using (true) with check (true);
create policy "estoque_itens_delete_authenticated" on estoque_itens
  for delete to authenticated using (true);

-- ============================================================
-- ESTOQUE — MOVIMENTOS
-- Livro-razão imutável: sem policy de update. Uma correção é feita
-- excluindo o movimento (o que reverte seu efeito, via trigger abaixo)
-- e registrando um novo.
-- ============================================================
create table if not exists estoque_movimentos (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references estoque_itens(id) on delete cascade,
  tipo text not null check (tipo in ('entrada', 'saida')),
  quantidade numeric(12,3) not null check (quantidade > 0),
  data date not null default current_date,
  motivo text,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists idx_estoque_movimentos_item_id on estoque_movimentos (item_id);
create index if not exists idx_estoque_movimentos_data on estoque_movimentos (data);

alter table estoque_movimentos enable row level security;

create policy "estoque_movimentos_select_authenticated" on estoque_movimentos
  for select to authenticated using (true);
create policy "estoque_movimentos_insert_authenticated" on estoque_movimentos
  for insert to authenticated with check (true);
create policy "estoque_movimentos_delete_authenticated" on estoque_movimentos
  for delete to authenticated using (true);

-- Aplica o efeito do movimento na quantidade atual do item.
-- Se o resultado violar quantidade_atual >= 0 (saída maior que o
-- disponível), a transação inteira é revertida pelo Postgres.
create or replace function estoque_aplicar_movimento()
returns trigger as $$
begin
  if new.tipo = 'entrada' then
    update estoque_itens
      set quantidade_atual = quantidade_atual + new.quantidade
      where id = new.item_id;
  else
    update estoque_itens
      set quantidade_atual = quantidade_atual - new.quantidade
      where id = new.item_id;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger trg_estoque_movimento_insert
after insert on estoque_movimentos
for each row execute function estoque_aplicar_movimento();

-- Reverte o efeito do movimento ao ser excluído.
create or replace function estoque_reverter_movimento()
returns trigger as $$
begin
  if old.tipo = 'entrada' then
    update estoque_itens
      set quantidade_atual = quantidade_atual - old.quantidade
      where id = old.item_id;
  else
    update estoque_itens
      set quantidade_atual = quantidade_atual + old.quantidade
      where id = old.item_id;
  end if;
  return old;
end;
$$ language plpgsql security definer set search_path = public;

create trigger trg_estoque_movimento_delete
after delete on estoque_movimentos
for each row execute function estoque_reverter_movimento();
