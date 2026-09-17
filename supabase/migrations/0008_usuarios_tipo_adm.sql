-- Papel do usuário: 'usuario' (padrão) ou 'adm'. Só ADM gerencia a aba
-- Usuários (aprovar cadastro pendente e definir quem é ADM) — um
-- "usuario" comum usa o resto do sistema normalmente, mas nem vê essa aba.
alter table usuarios add column if not exists tipo text not null default 'usuario' check (tipo in ('usuario', 'adm'));

-- Everton pediu explicitamente essa mudança se identificando como ADM —
-- e alguém precisa nascer ADM, senão ninguém consegue promover ninguém.
update usuarios set tipo = 'adm' where email = 'everton.medeiroscf@gmail.com';

create or replace function usuario_e_adm()
returns boolean as $$
  select exists (
    select 1 from usuarios where id = auth.uid() and tipo = 'adm' and aprovado
  );
$$ language sql security definer stable set search_path = public;

-- Assim como usuario_esta_aprovado(), esta função é chamada DENTRO de
-- policies de RLS — authenticated precisa de EXECUTE para as próprias
-- queries funcionarem (security definer só isenta o corpo da função de
-- RLS, não a permissão de invocá-la; isso já nos mordeu uma vez).
revoke execute on function usuario_e_adm() from public, anon;
grant execute on function usuario_e_adm() to authenticated;

-- Leitura: qualquer autenticado vê a própria linha (necessário para a
-- tela de aguardando aprovação e para o NavBar saber se mostra "Usuários");
-- só ADM vê a lista inteira.
drop policy "usuarios_select_authenticated" on usuarios;
create policy "usuarios_select_propria_ou_adm" on usuarios
  for select to authenticated using (id = auth.uid() or usuario_e_adm());

-- Só ADM aprova/revoga acesso e só ADM promove/rebaixa outro ADM.
drop policy "usuarios_update_aprovados" on usuarios;
create policy "usuarios_update_adm" on usuarios
  for update to authenticated using (usuario_e_adm()) with check (true);
