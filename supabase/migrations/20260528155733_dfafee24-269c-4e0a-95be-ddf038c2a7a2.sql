-- Migration: REAPER de runs órfãos (item 4) — agenda o reap-orphan-runs via pg_cron.
--
-- ⚠️ APLICAR VIA MCP (Lovable Cloud não auto-aplica migrations). Antes de rodar,
-- SUBSTITUA os 2 placeholders:
--   __SUPABASE_URL__       -> ex: https://<project-ref>.supabase.co
--   __SERVICE_ROLE_KEY__   -> a service_role key do projeto
-- (Não commitamos a key no repo; o Maestro preenche ao aplicar.)

-- Extensões: pg_cron já existe; pg_net é necessário p/ o net.http_post.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Índice p/ acelerar a varredura do reaper (inbound processados por janela de tempo).
CREATE INDEX IF NOT EXISTS messages_reaper_idx
  ON public.messages (from_type, processed_by_nina, created_at);

-- (Re)agenda o job a cada 2 min — idempotente (remove o anterior se existir).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'reap-orphan-runs-2min') THEN
    PERFORM cron.unschedule('reap-orphan-runs-2min');
  END IF;
END $$;

SELECT cron.schedule(
  'reap-orphan-runs-2min',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url     := '__SUPABASE_URL__/functions/v1/reap-orphan-runs',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer __SERVICE_ROLE_KEY__'
    ),
    body    := '{}'::jsonb
  );
  $$
);
