-- Estende a sincronização: além de criar/cancelar a nota quando "emissão de
-- nota" muda, agora também mantém venda/valor/pago/forma/banco/dt pg da nota
-- ativa sempre iguais ao pedido enquanto a emissão continuar marcada — esses
-- campos deixam de ser editáveis na tela de Notas Fiscais (só em Pedidos).
create or replace function sync_nota_fiscal_from_pedido()
returns trigger as $$
declare
  nota_ativa notas_fiscais%rowtype;
begin
  if tg_op = 'INSERT' then
    if new.emissao_nota then
      insert into notas_fiscais (pedido_id, valor, valor_pago, pago, forma_pagamento, banco, data_pagamento)
      values (new.id, new.valor_total, new.valor_pago, new.status = 'pago', new.forma_pagamento, new.banco, new.data_pagamento);
    end if;
    return new;
  end if;

  if new.emissao_nota and not old.emissao_nota then
    if not exists (
      select 1 from notas_fiscais where pedido_id = new.id and not cancelada
    ) then
      insert into notas_fiscais (pedido_id, valor, valor_pago, pago, forma_pagamento, banco, data_pagamento)
      values (new.id, new.valor_total, new.valor_pago, new.status = 'pago', new.forma_pagamento, new.banco, new.data_pagamento);
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
  elsif new.emissao_nota and old.emissao_nota then
    update notas_fiscais
      set valor = new.valor_total,
          valor_pago = new.valor_pago,
          pago = (new.status = 'pago'),
          forma_pagamento = new.forma_pagamento,
          banco = new.banco,
          data_pagamento = new.data_pagamento
      where pedido_id = new.id and not cancelada;
  end if;

  return new;
end;
$$ language plpgsql set search_path = public;
