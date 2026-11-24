-- Lembrete diário na Google Agenda com a situação financeira dos eventos do DIA SEGUINTE.
--
-- Para cada dia que tem evento (pedidos.data_evento), o sistema mantém UM evento na Google Agenda,
-- no dia anterior, listando os eventos e se estão pagos, pela metade ou pendentes. Esta tabela só
-- guarda qual evento da agenda corresponde a cada dia, para o sistema atualizar ou apagar o mesmo
-- evento depois (em vez de criar outro). Chave = o dia dos EVENTOS (o lembrete fica no dia anterior).
--
-- Mesma regra de acesso da aba Pedidos: quem tem acesso a Pedidos lê e grava. É controle interno
-- da integração, por isso não vai para o Histórico.
create table if not exists agenda_lembretes_financeiros (
  data_evento date primary key,
  google_event_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_agenda_lembretes_financeiros_updated_at
before update on agenda_lembretes_financeiros
for each row execute function set_updated_at();

alter table agenda_lembretes_financeiros enable row level security;

create policy "agenda_lembretes_select_acesso" on agenda_lembretes_financeiros
  for select to authenticated using (usuario_tem_acesso(array['pedidos']));
create policy "agenda_lembretes_insert_acesso" on agenda_lembretes_financeiros
  for insert to authenticated with check (usuario_tem_acesso(array['pedidos']));
create policy "agenda_lembretes_update_acesso" on agenda_lembretes_financeiros
  for update to authenticated using (usuario_tem_acesso(array['pedidos'])) with check (usuario_tem_acesso(array['pedidos']));
create policy "agenda_lembretes_delete_acesso" on agenda_lembretes_financeiros
  for delete to authenticated using (usuario_tem_acesso(array['pedidos']));
