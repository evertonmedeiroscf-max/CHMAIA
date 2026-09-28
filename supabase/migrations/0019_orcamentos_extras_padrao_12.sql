-- O % de extras inicial é definido na tela pelo tipo de cliente (PJ 12%,
-- PF 6% — ver PERCENTUAL_EXTRAS_PADRAO em lib/utils/orcamento.ts) e sempre
-- enviado no formulário. Este default só vale para inserções fora da tela.
alter table orcamentos alter column percentual_extras set default 12;
