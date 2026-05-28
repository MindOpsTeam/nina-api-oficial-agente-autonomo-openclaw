-- Migration: REAPER de runs órfãos (item 4) — extensões + índice.
--
-- O AGENDAMENTO do cron foi movido para uma migration ESTÁTICA posterior
-- (.._reaper_cron_static.sql), que usa public.trigger_reaper() lendo o
-- PANEL_TOKEN + SUPABASE_URL do Vault em RUNTIME — zero placeholder/segredo,
-- aplicável automaticamente no remix. Aqui ficam só extensões e índice (estáticos).

-- Extensões: pg_cron já existe; pg_net é necessário p/ o net.http_post.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Índice p/ acelerar a varredura do reaper (inbound processados por janela de tempo).
CREATE INDEX IF NOT EXISTS messages_reaper_idx
  ON public.messages (from_type, processed_by_nina, created_at);
