-- Migration ESTÁTICA: cron DIÁRIO do pack follow-up (nina-stale-leads).
-- Reusa EXATAMENTE o padrão do reaper (#39): trigger_<x>() SECURITY DEFINER lê
-- PANEL_TOKEN + SUPABASE_URL do Vault em runtime -> net.http_post (header
-- X-Panel-Token). Zero placeholder/segredo. Idempotente. Sem secrets -> no-op.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.trigger_stale_leads()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_url   text := rtrim(coalesce(public.get_secret('SUPABASE_URL'), ''), '/');
  v_token text := coalesce(public.get_secret('PANEL_TOKEN'), '');
BEGIN
  IF v_url = '' OR v_token = '' THEN
    RETURN; -- ainda não provisionado -> no-op
  END IF;
  PERFORM net.http_post(
    url     := v_url || '/functions/v1/nina-stale-leads',
    headers := jsonb_build_object('Content-Type', 'application/json', 'X-Panel-Token', v_token),
    body    := '{}'::jsonb
  );
END;
$$;

REVOKE ALL ON FUNCTION public.trigger_stale_leads() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trigger_stale_leads() FROM anon;
REVOKE ALL ON FUNCTION public.trigger_stale_leads() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.trigger_stale_leads() TO postgres;
GRANT EXECUTE ON FUNCTION public.trigger_stale_leads() TO service_role;

-- Cron diário (13:00 UTC ≈ 10:00 BRT). Idempotente (unschedule by name).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'nina-stale-leads-daily') THEN
    PERFORM cron.unschedule('nina-stale-leads-daily');
  END IF;
END $$;

SELECT cron.schedule('nina-stale-leads-daily', '0 13 * * *', $CRON$SELECT public.trigger_stale_leads();$CRON$);
