-- ============================================================
-- NOTAS FISCAIS
-- Rastreia a emissão e o pagamento da nota fiscal de um pedido.
-- É intencionalmente independente do status de pagamento do próprio
-- pedido (na prática, uma nota pode ser paga em data/valor diferentes
-- do que consta na venda que a originou).
-- ============================================================
create table if not exists notas_fiscais (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references pedidos(id) on delete cascade,
  numero_nota text,
  valor numeric(12,2) not null check (valor > 0),
  valor_pago numeric(12,2) not null default 0 check (valor_pago >= 0),
  falta_pagar numeric(12,2) generated always as (valor - valor_pago) stored,
  data_emissao date,
  previsao_pagamento date,
  pago boolean not null default false,
  forma_pagamento text check (
    forma_pagamento in ('Pix', 'Dinheiro', 'Cartão de débito', 'Cartão de crédito', 'Transferência bancária', 'Boleto')
  ),
  banco text,
  data_pagamento date,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint valor_pago_nao_excede_valor_nota check (valor_pago <= valor)
);

create index if not exists idx_notas_fiscais_pedido_id on notas_fiscais (pedido_id);
create index if not exists idx_notas_fiscais_data_emissao on notas_fiscais (data_emissao);

create trigger trg_notas_fiscais_updated_at
before update on notas_fiscais
for each row execute function set_updated_at();

alter table notas_fiscais enable row level security;

create policy "notas_fiscais_select_authenticated" on notas_fiscais
  for select to authenticated using (true);
create policy "notas_fiscais_insert_authenticated" on notas_fiscais
  for insert to authenticated with check (true);
create policy "notas_fiscais_update_authenticated" on notas_fiscais
  for update to authenticated using (true) with check (true);
create policy "notas_fiscais_delete_authenticated" on notas_fiscais
  for delete to authenticated using (true);
