-- O orçamento pode ser salvo só com os dados do cliente (valor R$ 0,00) e
-- ganhar valor depois, quando a planilha for montada. Pedido continua
-- exigindo valor > 0 — por isso converterEmPedido barra orçamento zerado.
alter table orcamentos drop constraint if exists orcamentos_valor_total_check;
alter table orcamentos add constraint orcamentos_valor_total_check check (valor_total >= 0);
alter table orcamentos alter column valor_total set default 0;
