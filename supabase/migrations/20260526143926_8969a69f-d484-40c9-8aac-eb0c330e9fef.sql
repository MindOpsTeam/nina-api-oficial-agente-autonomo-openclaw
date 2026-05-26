-- Migration: Brain Provider (Fase 1) — permite que a Nina "pense" via Lovable AI (padrão) ou OpenClaw.
-- Aditivo: brain_provider default 'lovable' => comportamento idêntico ao atual (zero regressão).
-- Tokens seguem o padrão do repo (coluna TEXT mascarada na UI, como elevenlabs_api_key/whatsapp_access_token). Sem vault.

ALTER TABLE public.nina_settings
  ADD COLUMN IF NOT EXISTS brain_provider text NOT NULL DEFAULT 'lovable',
  ADD COLUMN IF NOT EXISTS openclaw_gateway_url text,
  ADD COLUMN IF NOT EXISTS openclaw_gateway_token text,
  ADD COLUMN IF NOT EXISTS openclaw_model text DEFAULT 'openclaw',
  ADD COLUMN IF NOT EXISTS brain_repo_url text;

-- Constraint de domínio para brain_provider (idempotente)
ALTER TABLE public.nina_settings
  DROP CONSTRAINT IF EXISTS nina_settings_brain_provider_check;

ALTER TABLE public.nina_settings
  ADD CONSTRAINT nina_settings_brain_provider_check
  CHECK (brain_provider IN ('lovable', 'openclaw'));

COMMENT ON COLUMN public.nina_settings.brain_provider IS 'Provedor de raciocínio da Nina: lovable (padrão) ou openclaw';
COMMENT ON COLUMN public.nina_settings.openclaw_gateway_url IS 'Endpoint OpenClaw OpenAI-compatible (POST /v1/chat/completions)';
COMMENT ON COLUMN public.nina_settings.openclaw_gateway_token IS 'Bearer token do gateway OpenClaw (mascarado na UI)';
COMMENT ON COLUMN public.nina_settings.openclaw_model IS 'Identificador de modelo enviado ao OpenClaw';
COMMENT ON COLUMN public.nina_settings.brain_repo_url IS 'URL do repositório do agente OpenClaw (referência/documentação)';
