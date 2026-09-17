-- Nota é cancelada (não excluída) quando já tem número e a emissão é
-- desmarcada — um documento fiscal numerado não pode só desaparecer.
alter table notas_fiscais add column if not exists cancelada boolean not null default false;

-- Previsão de pagamento é sempre emissão + 15 dias (regra do negócio);
-- deixa de ser um campo editável e passa a ser sempre coerente.
alter table notas_fiscais drop column previsao_pagamento;
alter table notas_fiscais add column previsao_pagamento date generated always as (data_emissao + 15) stored;

-- Mantém a Relatório de Notas Fiscais sincronizada com o campo
-- "emissão de nota" do pedido:
--  - liga para Sim (e não existe nota ativa para esse pedido) -> cria a nota,
--    copiando venda/valor/pago; usuário só preenche número e data de emissão.
--  - volta para Não -> se a nota já tinha número, marca como cancelada
--    (fica visível, com um aviso, não some); se não tinha número ainda,
--    apenas remove (não havia documento fiscal real emitido).
create or replace function sync_nota_fiscal_from_pedido()
returns trigger as $$
declare
  nota_ativa notas_fiscais%rowtype;
begin
  if tg_op = 'INSERT' then
    if new.emissao_nota then
      insert into notas_fiscais (pedido_id, valor, valor_pago, pago)
      values (new.id, new.valor_total, new.valor_pago, new.status = 'pago');
    end if;
    return new;
  end if;

  if new.emissao_nota and not old.emissao_nota then
    if not exists (
      select 1 from notas_fiscais where pedido_id = new.id and not cancelada
    ) then
      insert into notas_fiscais (pedido_id, valor, valor_pago, pago)
      values (new.id, new.valor_total, new.valor_pago, new.status = 'pago');
    end if;
  elsif not new.emissao_nota and old.emissao_nota then
    select * into nota_ativa from notas_fiscais
      where pedido_id = new.id and not cancelada
      limit 1;
    if found then
      if nota_ativa.numero_nota is not null then
        update notas_fiscais set cancelada = true where id = nota_ativa.id;
      else
        delete from notas_fiscais where id = nota_ativa.id;
      end if;
    end if;
  end if;

  return new;
end;
$$ language plpgsql set search_path = public;

drop trigger if exists trg_pedidos_sync_nota_fiscal on pedidos;
create trigger trg_pedidos_sync_nota_fiscal
after insert or update on pedidos
for each row execute function sync_nota_fiscal_from_pedido();
