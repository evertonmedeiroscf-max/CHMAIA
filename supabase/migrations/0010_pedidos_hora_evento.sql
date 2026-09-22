-- Hora do evento (opcional), ao lado da data do evento.
alter table pedidos add column if not exists hora_evento time;
