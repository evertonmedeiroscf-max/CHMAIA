-- Fichas técnicas: tipo FINALIZAÇÃO, ingrediente que é outra ficha (Base) e
-- linhas "sem origem" (importação do Excel).
--
-- FINALIZAÇÃO é gerada a partir da ficha de BASE do mesmo produto, para variar
-- a quantidade e precificar com o MARKUP: tem markup, "serve" (porções) e não
-- tem rendimento (o peso aproximado é a soma dos pesos líquidos). Já a BASE
-- continua exigindo rendimento > 0.
--
-- Cada linha de ingrediente agora aponta para UM item do Estoque OU para UMA
-- ficha de Base (o custo vem do custo/kg dela), ou para nenhum dos dois
-- quando a importação não conseguiu associar com clareza (sem_origem = true:
-- o campo fica em branco, a tela realça a linha e mostra o nome que estava no
-- arquivo + o motivo). Peso líquido e FC passam a poder ficar nulos: o sistema
-- nunca assume um valor que o arquivo de origem não trouxe.

-- ============================================================
-- FICHAS_TECNICAS
-- ============================================================
alter table fichas_tecnicas drop constraint if exists fichas_tecnicas_tipo_check;
alter table fichas_tecnicas add constraint fichas_tecnicas_tipo_check check (tipo in ('bases', 'finalizacao'));

alter table fichas_tecnicas alter column rendimento_kg drop not null;
alter table fichas_tecnicas add constraint fichas_tecnicas_rendimento_da_base
  check (tipo <> 'bases' or rendimento_kg > 0);

alter table fichas_tecnicas
  add column if not exists markup numeric(12,4) check (markup is null or markup >= 0),
  add column if not exists serve numeric(12,2) check (serve is null or serve > 0),
  add column if not exists nome_aba text;

-- ============================================================
-- FICHAS_TECNICAS_INGREDIENTES
-- ============================================================
alter table fichas_tecnicas_ingredientes
  alter column estoque_item_id drop not null,
  alter column peso_liquido drop not null,
  alter column fc drop not null;

alter table fichas_tecnicas_ingredientes
  add column if not exists ficha_ingrediente_id uuid references fichas_tecnicas(id) on delete restrict,
  add column if not exists ingrediente_origem text,
  add column if not exists sem_origem boolean not null default false,
  add column if not exists sem_origem_motivo text;

alter table fichas_tecnicas_ingredientes add constraint fichas_ingredientes_um_destino
  check (not (estoque_item_id is not null and ficha_ingrediente_id is not null));
alter table fichas_tecnicas_ingredientes add constraint fichas_ingredientes_nao_e_ela_mesma
  check (ficha_ingrediente_id is null or ficha_ingrediente_id <> ficha_id);
alter table fichas_tecnicas_ingredientes add constraint fichas_ingredientes_sem_origem_sem_destino
  check (not sem_origem or (estoque_item_id is null and ficha_ingrediente_id is null));

create index if not exists idx_fichas_tecnicas_ingredientes_ficha_ingrediente
  on fichas_tecnicas_ingredientes (ficha_ingrediente_id);
