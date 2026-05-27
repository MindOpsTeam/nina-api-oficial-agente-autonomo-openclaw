-- Migration: T1 — modelo de dados do Treino/Brain Build (fundação).
-- Personalização da Nina pela tela /cerebro, versionada no repo do CLIENTE.
-- RLS owner-scoped em tudo; trigger updated_at padrão do repo
-- (public.update_updated_at_column). Aditivo. Não toca orchestrator/whatsapp/filas.

-- ============================================================================
-- brain_products: catálogo de produtos/soluções do cliente.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.brain_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  summary text,
  details_md text,
  position int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.brain_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_all_brain_products" ON public.brain_products;
CREATE POLICY "owner_all_brain_products" ON public.brain_products
  FOR ALL TO authenticated
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

DROP POLICY IF EXISTS "service_role_all_brain_products" ON public.brain_products;
CREATE POLICY "service_role_all_brain_products" ON public.brain_products
  FOR ALL USING (auth.role() = 'service_role');

DROP TRIGGER IF EXISTS brain_products_updated_at_trigger ON public.brain_products;
CREATE TRIGGER brain_products_updated_at_trigger
  BEFORE UPDATE ON public.brain_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- brain_knowledge: base de conhecimento (markdown) do cliente.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.brain_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL DEFAULT auth.uid(),
  title text NOT NULL,
  slug text NOT NULL,
  content_md text NOT NULL,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_user_id, slug)
);

ALTER TABLE public.brain_knowledge ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_all_brain_knowledge" ON public.brain_knowledge;
CREATE POLICY "owner_all_brain_knowledge" ON public.brain_knowledge
  FOR ALL TO authenticated
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

DROP POLICY IF EXISTS "service_role_all_brain_knowledge" ON public.brain_knowledge;
CREATE POLICY "service_role_all_brain_knowledge" ON public.brain_knowledge
  FOR ALL USING (auth.role() = 'service_role');

DROP TRIGGER IF EXISTS brain_knowledge_updated_at_trigger ON public.brain_knowledge;
CREATE TRIGGER brain_knowledge_updated_at_trigger
  BEFORE UPDATE ON public.brain_knowledge
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- Persona editável em nina_settings (jsonb estruturado).
-- REUSA o que já existe (não duplica): persona_nome -> sdr_name,
-- empresa_nome -> company_name, prompt completo -> system_prompt_override,
-- repo do cliente -> brain_repo_url. brain_identity guarda só os campos NOVOS.
-- Chaves esperadas: empresa_missao, empresa_tagline, fundadores, prova_social,
-- tom, guardrails, publico_alvo.
-- ============================================================================
ALTER TABLE public.nina_settings
  ADD COLUMN IF NOT EXISTS brain_identity jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.nina_settings.brain_identity IS
  'Identidade editável da Nina (/cerebro). Chaves: empresa_missao, empresa_tagline, fundadores, prova_social, tom, guardrails, publico_alvo. persona_nome=sdr_name, empresa_nome=company_name (reusados, não duplicar).';

-- ============================================================================
-- set_secret(name, value): grava segredo no Vault (fundação p/ o PAT do GitHub
-- do cliente — GITHUB_BRAIN_TOKEN — que NÃO vai em coluna). Complementa o
-- public.get_secret (F3a). SECURITY DEFINER, EXECUTE só por service_role —
-- o segredo nunca é setável/legível pelo cliente (anon/authenticated).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.set_secret(secret_name text, secret_value text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  existing_id uuid;
BEGIN
  SELECT id INTO existing_id FROM vault.secrets WHERE name = secret_name;
  IF existing_id IS NULL THEN
    PERFORM vault.create_secret(secret_value, secret_name);
  ELSE
    PERFORM vault.update_secret(existing_id, secret_value, secret_name);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_secret(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_secret(text, text) FROM anon;
REVOKE ALL ON FUNCTION public.set_secret(text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.set_secret(text, text) TO service_role;
