-- Amplia o cadastro de Estoque pra seguir a planilha de referência do
-- usuário (Descrição/Item, Categoria, Unid., Preço corrente, Custo/Und.,
-- Dt atualiz. preço, Marca/Fornecedor, Estoque mínimo, Estoque atual,
-- Valor total em estoque, Dt atualiz. estoque).
alter table estoque_itens add column if not exists preco_corrente numeric(12,2);
alter table estoque_itens add column if not exists custo_unidade numeric(12,2);
alter table estoque_itens add column if not exists marca_fornecedor text;
alter table estoque_itens add column if not exists data_atualizacao_preco date;
alter table estoque_itens add column if not exists data_atualizacao_estoque date;

-- Valor total em estoque = custo por unidade × quantidade atual — sempre
-- calculado pelo banco, igual falta_pagar em pedidos (nunca editado à mão).
alter table estoque_itens add column if not exists valor_total_estoque numeric(14,2)
  generated always as (coalesce(custo_unidade, 0) * quantidade_atual) stored;

-- Data de atualização do preço: marcada sozinha sempre que preço corrente
-- ou custo/und. mudarem — nunca editada à mão, pra refletir a realidade.
create or replace function estoque_marcar_atualizacao_preco()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    if new.preco_corrente is not null or new.custo_unidade is not null then
      new.data_atualizacao_preco := current_date;
    end if;
  elsif (new.preco_corrente is distinct from old.preco_corrente) or (new.custo_unidade is distinct from old.custo_unidade) then
    new.data_atualizacao_preco := current_date;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_estoque_atualizacao_preco
before insert or update on estoque_itens
for each row execute function estoque_marcar_atualizacao_preco();

-- Data de atualização do estoque: marcada sozinha sempre que a quantidade
-- atual mudar (estoque inicial na criação, ou entrada/saída de movimento).
create or replace function estoque_marcar_atualizacao_estoque()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    new.data_atualizacao_estoque := current_date;
  elsif new.quantidade_atual is distinct from old.quantidade_atual then
    new.data_atualizacao_estoque := current_date;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_estoque_atualizacao_estoque
before insert or update on estoque_itens
for each row execute function estoque_marcar_atualizacao_estoque();
