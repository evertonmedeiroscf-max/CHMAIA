-- Corrige avisos do Supabase Security Advisor detectados após aplicar
-- 0001_init.sql em produção (function_search_path_mutable e as duas
-- variantes de anon/authenticated_security_definer_function_executable).

-- Fixa search_path da função utilitária (mesma prática já usada nas de estoque).
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql set search_path = public;

-- Funções de trigger não devem ser chamáveis diretamente via API REST —
-- o PostgREST expõe qualquer função do schema public por padrão, e o
-- Supabase concede EXECUTE em novas funções a anon/authenticated por
-- default privilege além do PUBLIC, então é preciso revogar das três.
revoke execute on function estoque_aplicar_movimento() from public, anon, authenticated;
revoke execute on function estoque_reverter_movimento() from public, anon, authenticated;
revoke execute on function set_updated_at() from public;
