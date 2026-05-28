-- Migration ESTÁTICA: cron DIÁRIO do pack follow-up (nina-stale-leads).
-- Reusa EXATAMENTE o padrão do reaper (#39): trigger_<x>() SECURITY DEFINER lê
-- PANEL_TOKEN + SUPABASE_URL do Vault em runtime -> net.http_post (header
-- X-Panel-Token). Zero placeholder/segredo. Idempotente. Sem secrets -> no-op.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Lock singleton p/ serializar o nina-stale-leads (R1-bis): o cron */13 com
-- geração Lovable pode passar de 13min -> 2 runs concorrentes -> follow-up
-- duplicado. Mesmo padrão JÁ PROVADO do reaper_lock (#39): UPDATE condicional
-- atômico + stale window; linha PRÓPRIA (não contende com o reaper). RLS: só service_role.
CREATE TABLE IF NOT EXISTS public.stale_leads_lock (
  id boolean PRIMARY KEY DEFAULT true,
  locked_at timestamptz,
  CONSTRAINT stale_leads_lock_singleton CHECK (id = true)
);
INSERT INTO public.stale_leads_lock (id, locked_at) VALUES (true, NULL) ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.stale_leads_lock ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_stale_leads_lock" ON public.stale_leads_lock;
CREATE POLICY "service_role_all_stale_leads_lock" ON public.stale_leads_lock
  FOR ALL USING (auth.role() = 'service_role');

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

-- Atualiza o config_schema do catálogo p/ o modelo VALOR+UNIDADE (default 23h).
-- Antes era {dias_sem_resposta:2}. Idempotente.
UPDATE public.skill_packs
   SET config_schema = '{"janela_valor": 23, "janela_unidade": "horas"}'::jsonb,
       updated_at = now()
 WHERE slug = 'follow-up';

-- Cron FREQUENTE (a cada 13 min, off-minute). Por quê não diário: com janela em
-- minutos/horas + guard de 24h da Meta, a elegibilidade é a faixa "parado há >
-- janela E < 24h" (ex.: 23h..24h = 1h). Um cron diário perderia essa faixa estreita;
-- */13 pega o lead que cruza a janela em poucos minutos, ainda dentro das 24h.
-- Off-minute (13) evita coincidir com o reaper (*/2) e outros crons (*/5, */15).
-- Idempotente (unschedule by name; remove tb o agendamento diário anterior).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'nina-stale-leads-daily') THEN
    PERFORM cron.unschedule('nina-stale-leads-daily');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'nina-stale-leads-tick') THEN
    PERFORM cron.unschedule('nina-stale-leads-tick');
  END IF;
END $$;

SELECT cron.schedule('nina-stale-leads-tick', '*/13 * * * *', $CRON$SELECT public.trigger_stale_leads();$CRON$);
