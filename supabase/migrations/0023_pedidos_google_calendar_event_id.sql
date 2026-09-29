-- Guarda o id do evento criado na Google Agenda pra saber qual evento
-- atualizar/excluir quando o pedido for editado ou apagado. Null enquanto a
-- integração não estiver configurada ou o pedido não tiver data/hora de
-- evento definidas.
alter table pedidos add column if not exists google_calendar_event_id text;
