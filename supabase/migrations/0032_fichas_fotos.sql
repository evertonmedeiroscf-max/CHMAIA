-- Fotos das fichas técnicas.
--
-- Duas posições fixas na ficha (e na impressão de uma folha A4):
--   'produto' = produto finalizado, parte SUPERIOR da ficha (1 ou 2 fotos)
--   'passo'   = passo a passo, parte INFERIOR, depois do modo de preparo (até 12, com legenda opcional)
--
-- O arquivo vai para um bucket PRIVADO (chave opaca = uuid.jpg, nunca o nome do prato) e só é
-- acessado por link temporário gerado no servidor, como as notas de compra (0024). Quem tem acesso
-- à aba Fichas técnicas vê, envia e apaga fotos. O limite por posição vale no banco.

-- ============================================================
-- BUCKET DE STORAGE (fotos, privado, só JPEG de até 4 MB — o navegador reduz a foto antes de enviar)
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fichas-fotos', 'fichas-fotos', false, 4194304, array['image/jpeg'])
on conflict (id) do nothing;

create policy "fichas_fotos_storage_select" on storage.objects
  for select to authenticated using (
    bucket_id = 'fichas-fotos' and usuario_tem_acesso(array['fichas-tecnicas'])
  );
create policy "fichas_fotos_storage_insert" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'fichas-fotos' and usuario_tem_acesso(array['fichas-tecnicas'])
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'
  );
create policy "fichas_fotos_storage_delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'fichas-fotos' and usuario_tem_acesso(array['fichas-tecnicas'])
  );

-- ============================================================
-- FICHAS_FOTOS
-- ============================================================
create table if not exists fichas_fotos (
  id uuid primary key default gen_random_uuid(),
  ficha_id uuid not null references fichas_tecnicas(id) on delete cascade,
  posicao text not null check (posicao in ('produto', 'passo')),
  ordem integer not null default 0,
  arquivo_path text not null unique,
  legenda text check (legenda is null or length(legenda) <= 80),
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fichas_fotos_ficha_idx on fichas_fotos (ficha_id, posicao, ordem);

create trigger trg_fichas_fotos_updated_at
before update on fichas_fotos
for each row execute function set_updated_at();

-- No máximo 2 fotos do produto e 12 do passo a passo por ficha.
create or replace function fichas_fotos_limite() returns trigger
language plpgsql as $$
declare
  maximo integer;
  atual integer;
begin
  maximo := case new.posicao when 'produto' then 2 else 12 end;
  select count(*) into atual from fichas_fotos where ficha_id = new.ficha_id and posicao = new.posicao;
  if atual >= maximo then
    raise exception 'Limite de % foto(s) % nesta ficha.', maximo,
      case new.posicao when 'produto' then 'do produto finalizado' else 'do passo a passo' end
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger trg_fichas_fotos_limite
before insert on fichas_fotos
for each row execute function fichas_fotos_limite();

alter table fichas_fotos enable row level security;

create policy "fichas_fotos_select_acesso" on fichas_fotos
  for select to authenticated using (usuario_tem_acesso(array['fichas-tecnicas']));
create policy "fichas_fotos_insert_acesso" on fichas_fotos
  for insert to authenticated with check (usuario_tem_acesso(array['fichas-tecnicas']));
create policy "fichas_fotos_update_acesso" on fichas_fotos
  for update to authenticated using (usuario_tem_acesso(array['fichas-tecnicas'])) with check (usuario_tem_acesso(array['fichas-tecnicas']));
create policy "fichas_fotos_delete_acesso" on fichas_fotos
  for delete to authenticated using (usuario_tem_acesso(array['fichas-tecnicas']));

-- Inserir/apagar foto aparece no Histórico, como nas outras abas.
create trigger trg_historico_fichas_fotos
after insert or update or delete on fichas_fotos
for each row execute function registrar_historico();
