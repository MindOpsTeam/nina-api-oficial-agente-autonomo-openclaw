-- Migration: F3a — backbone de registro/ciclo de vida das instâncias OpenClaw.
-- Replica o padrão da carteira-do-agente (instances + installer_tokens), adaptado
-- para multi-tenant owner-scoped da Nina. Aditivo, OFF-LIMITS-safe.

-- ============================================================================
-- instances: 1 linha por VPS OpenClaw que se auto-registra no app.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL DEFAULT auth.uid(),
  hostname text,
  openclaw_version text,
  ingress_url text,
  hooks_token text,
  openclaw_dashboard_token text,
  status text NOT NULL DEFAULT 'pending',
  last_heartbeat timestamptz,
  system_prompt text,
  agent_type text NOT NULL DEFAULT 'nina_sdr',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Upsert do instance-register é por (owner_user_id, hostname).
CREATE UNIQUE INDEX IF NOT EXISTS instances_owner_hostname_uniq
  ON public.instances (owner_user_id, hostname);

ALTER TABLE public.instances ENABLE ROW LEVEL SECURITY;

-- RLS owner-scoped (front lê/gere apenas as próprias instâncias).
DROP POLICY IF EXISTS "owner_all_instances" ON public.instances;
CREATE POLICY "owner_all_instances" ON public.instances
  FOR ALL TO authenticated
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

DROP POLICY IF EXISTS "service_role_all_instances" ON public.instances;
CREATE POLICY "service_role_all_instances" ON public.instances
  FOR ALL USING (auth.role() = 'service_role');

-- updated_at trigger (padrão do repo: public.update_updated_at_column).
DROP TRIGGER IF EXISTS instances_updated_at_trigger ON public.instances;
CREATE TRIGGER instances_updated_at_trigger
  BEFORE UPDATE ON public.instances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- installer_tokens: tokens one-time pro setup-installer (expira em 30min).
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.installer_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  owner_user_id uuid NOT NULL DEFAULT auth.uid(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 minutes'),
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.installer_tokens ENABLE ROW LEVEL SECURITY;

-- RLS owner-scoped.
DROP POLICY IF EXISTS "owner_select_installer_tokens" ON public.installer_tokens;
CREATE POLICY "owner_select_installer_tokens" ON public.installer_tokens
  FOR SELECT TO authenticated
  USING (auth.uid() = owner_user_id);

DROP POLICY IF EXISTS "owner_insert_installer_tokens" ON public.installer_tokens;
CREATE POLICY "owner_insert_installer_tokens" ON public.installer_tokens
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_user_id);

DROP POLICY IF EXISTS "service_role_all_installer_tokens" ON public.installer_tokens;
CREATE POLICY "service_role_all_installer_tokens" ON public.installer_tokens
  FOR ALL USING (auth.role() = 'service_role');
