-- Módulo de Orçamentos: proposta enviada a um cliente em potencial, antes
-- de virar um Pedido confirmado. Fica pendente/aprovado/recusado; um
-- aprovado pode ser convertido em Pedido com um clique (converterEmPedido
-- em app/(protected)/orcamentos/actions.ts), que grava o vínculo em
-- pedido_id para impedir converter duas vezes o mesmo orçamento.
create sequence if not exists orcamentos_numero_seq;

create table if not exists orcamentos (
  id uuid primary key default gen_random_uuid(),
  numero integer not null default nextval('orcamentos_numero_seq') unique,
  data_orcamento date not null default current_date,
  cliente text not null,
  entidade text not null default 'PF' check (entidade in ('PF', 'PJ')),
  data_evento date,
  hora_evento time,
  descricao text,
  valor_total numeric(12,2) not null check (valor_total > 0),
  validade date,
  status text not null default 'pendente' check (status in ('pendente', 'aprovado', 'recusado')),
  pedido_id uuid references pedidos(id) on delete set null,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter sequence orcamentos_numero_seq owned by orcamentos.numero;

create index if not exists idx_orcamentos_data_orcamento on orcamentos (data_orcamento);
create index if not exists idx_orcamentos_status on orcamentos (status);

create trigger trg_orcamentos_updated_at
before update on orcamentos
for each row execute function set_updated_at();

alter table orcamentos enable row level security;

-- Mesmo esquema de controle por aba já usado pelas outras tabelas (ver
-- usuario_tem_acesso() em 0009_usuarios_paginas_acesso.sql).
create policy "orcamentos_select_acesso" on orcamentos
  for select to authenticated using (usuario_tem_acesso(array['orcamentos']));
create policy "orcamentos_insert_acesso" on orcamentos
  for insert to authenticated with check (usuario_tem_acesso(array['orcamentos']));
create policy "orcamentos_update_acesso" on orcamentos
  for update to authenticated using (usuario_tem_acesso(array['orcamentos'])) with check (usuario_tem_acesso(array['orcamentos']));
create policy "orcamentos_delete_acesso" on orcamentos
  for delete to authenticated using (usuario_tem_acesso(array['orcamentos']));

-- Amplia o padrão de páginas liberadas para incluir a nova aba. Só afeta
-- cadastros novos — quem já está aprovado precisa que um ADM marque a aba
-- manualmente em Usuários.
alter table usuarios alter column paginas set default array['dashboard','orcamentos','pedidos','notas-fiscais','despesas','estoque'];
