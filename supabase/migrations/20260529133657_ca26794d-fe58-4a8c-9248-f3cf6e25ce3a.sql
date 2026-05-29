-- Migration: K0 — custom_knowledge_skills. Habilidades de CONHECIMENTO criadas pelo
-- próprio cliente (markdown), ligáveis na Loja, renderizadas ADITIVAS no nina-brain.
-- NÃO substitui identity/soul/knowledge da Nina nem os packs curados (skill_packs).
-- ESTÁTICA + idempotente. Mesmo padrão de RLS/trigger do installed_packs (SP0).

CREATE TABLE IF NOT EXISTS public.custom_knowledge_skills (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL DEFAULT auth.uid(),
  slug          text NOT NULL,
  name          text NOT NULL,
  description   text,
  content       text NOT NULL,
  enabled       boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  -- SEGURANÇA DO SLUG: vira nome de diretório skills/<...>/ no nina-brain. Só
  -- minúsculas/números/hífen (sem '/', '.', '..') -> sem path-traversal. 2–41 chars.
  CONSTRAINT custom_knowledge_skills_slug_safe CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,40}$'),
  UNIQUE (owner_user_id, slug)
);

ALTER TABLE public.custom_knowledge_skills ENABLE ROW LEVEL SECURITY;

-- RLS owner-scoped (igual installed_packs).
DROP POLICY IF EXISTS "owner_all_custom_knowledge_skills" ON public.custom_knowledge_skills;
CREATE POLICY "owner_all_custom_knowledge_skills" ON public.custom_knowledge_skills
  FOR ALL TO authenticated
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

DROP POLICY IF EXISTS "service_role_all_custom_knowledge_skills" ON public.custom_knowledge_skills;
CREATE POLICY "service_role_all_custom_knowledge_skills" ON public.custom_knowledge_skills
  FOR ALL USING (auth.role() = 'service_role');

-- updated_at trigger (padrão do repo).
DROP TRIGGER IF EXISTS custom_knowledge_skills_updated_at_trigger ON public.custom_knowledge_skills;
CREATE TRIGGER custom_knowledge_skills_updated_at_trigger
  BEFORE UPDATE ON public.custom_knowledge_skills
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
