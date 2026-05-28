-- Migration ESTÁTICA: agenda o cron do reaper (zero-toque, sem placeholder/segredo).
--
-- Aplicável automaticamente no remix. O segredo (PANEL_TOKEN) e a URL do projeto
-- (SUPABASE_URL) são lidos do Vault EM RUNTIME por public.trigger_reaper() —
-- nada de service-role key embutida no cron.job. Ambos os segredos são populados
-- pela edge fn provision-secrets no onboarding; até lá, o trigger é no-op seguro.

-- Lock singleton p/ serializar execuções do reaper (evita 2 runs concorrentes ->
-- fallback duplicado). UPDATE condicional atômico no reap-orphan-runs; este é só
-- o storage. RLS: só service_role (a edge fn usa service-role; cliente não acessa).
CREATE TABLE IF NOT EXISTS public.reaper_lock (
  id boolean PRIMARY KEY DEFAULT true,
  locked_at timestamptz,
  CONSTRAINT reaper_lock_singleton CHECK (id = true)
);
INSERT INTO public.reaper_lock (id, locked_at) VALUES (true, NULL) ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.reaper_lock ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_reaper_lock" ON public.reaper_lock;
CREATE POLICY "service_role_all_reaper_lock" ON public.reaper_lock
  FOR ALL USING (auth.role() = 'service_role');

-- Função que o cron chama: lê os segredos do Vault e dispara o reaper via HTTP.
-- SECURITY DEFINER -> roda como o owner (acesso a vault via get_secret + a net).
-- Auth da chamada: header X-Panel-Token (a fn reap-orphan-runs valida vs Vault).
CREATE OR REPLACE FUNCTION public.trigger_reaper()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_url   text := rtrim(coalesce(public.get_secret('SUPABASE_URL'), ''), '/');
  v_token text := coalesce(public.get_secret('PANEL_TOKEN'), '');
BEGIN
  -- Ainda não provisionado (secrets ausentes) -> no-op (sem erro).
  IF v_url = '' OR v_token = '' THEN
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := v_url || '/functions/v1/reap-orphan-runs',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Panel-Token', v_token
    ),
    body    := '{}'::jsonb
  );
END;
$$;

-- Só o servidor dispara o reaper (nunca o cliente via PostgREST).
REVOKE ALL ON FUNCTION public.trigger_reaper() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trigger_reaper() FROM anon;
REVOKE ALL ON FUNCTION public.trigger_reaper() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.trigger_reaper() TO postgres;
GRANT EXECUTE ON FUNCTION public.trigger_reaper() TO service_role;

-- (Re)agenda o cron a cada 2 min — idempotente (remove qualquer job anterior de
-- mesmo nome, inclusive o placeholder antigo). O corpo é estático.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'reap-orphan-runs-2min') THEN
    PERFORM cron.unschedule('reap-orphan-runs-2min');
  END IF;
END $$;

SELECT cron.schedule('reap-orphan-runs-2min', '*/2 * * * *', $CRON$SELECT public.trigger_reaper();$CRON$);
