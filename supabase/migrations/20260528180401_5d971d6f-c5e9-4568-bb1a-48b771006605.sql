-- Migration: SP0 — Skill Packs (modelo + registry). ESTÁTICA + idempotente.
-- Catálogo curado pelo app (V1, no DB). Single-tenant. Não toca OFF-LIMITS.
-- Trigger updated_at: padrão do repo (public.update_updated_at_column).

-- ============================================================================
-- skill_packs: CATÁLOGO curado (leitura p/ authenticated; escrita só service_role).
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.skill_packs (
  slug              text PRIMARY KEY,
  name              text NOT NULL,
  description       text,
  level             text NOT NULL CHECK (level IN ('conhecimento', 'ferramenta')),
  requires_secrets  text[] NOT NULL DEFAULT '{}',
  requires_edge_fns text[] NOT NULL DEFAULT '{}',
  config_schema     jsonb  NOT NULL DEFAULT '{}'::jsonb,
  active_by_default boolean NOT NULL DEFAULT false,
  position          int    NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.skill_packs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_read_skill_packs" ON public.skill_packs;
CREATE POLICY "authenticated_read_skill_packs" ON public.skill_packs
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "service_role_all_skill_packs" ON public.skill_packs;
CREATE POLICY "service_role_all_skill_packs" ON public.skill_packs
  FOR ALL USING (auth.role() = 'service_role');

DROP TRIGGER IF EXISTS skill_packs_updated_at_trigger ON public.skill_packs;
CREATE TRIGGER skill_packs_updated_at_trigger
  BEFORE UPDATE ON public.skill_packs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- installed_packs: estado POR OWNER (liga/desliga + config). RLS owner-scoped.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.installed_packs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL DEFAULT auth.uid(),
  pack_slug     text NOT NULL REFERENCES public.skill_packs(slug) ON DELETE CASCADE,
  enabled       boolean NOT NULL DEFAULT false,
  config        jsonb   NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_user_id, pack_slug)
);

ALTER TABLE public.installed_packs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_all_installed_packs" ON public.installed_packs;
CREATE POLICY "owner_all_installed_packs" ON public.installed_packs
  FOR ALL TO authenticated
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

DROP POLICY IF EXISTS "service_role_all_installed_packs" ON public.installed_packs;
CREATE POLICY "service_role_all_installed_packs" ON public.installed_packs
  FOR ALL USING (auth.role() = 'service_role');

DROP TRIGGER IF EXISTS installed_packs_updated_at_trigger ON public.installed_packs;
CREATE TRIGGER installed_packs_updated_at_trigger
  BEFORE UPDATE ON public.installed_packs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- SEED dos 3 packs V1 (idempotente — o catálogo é autoritativo via DO UPDATE).
-- ============================================================================
INSERT INTO public.skill_packs
  (slug, name, description, level, requires_secrets, requires_edge_fns, config_schema, active_by_default, position)
VALUES
  ('follow-up',
   'Follow-up automático',
   'Detecta leads parados e dispara um follow-up consultivo automaticamente.',
   'ferramenta',
   '{}',
   ARRAY['nina-stale-leads'],
   '{"dias_sem_resposta": 2}'::jsonb,
   false, 1),
  ('pesquisa-empresa',
   'Pesquisa de empresa',
   'Pesquisa o site/empresa do prospect (Firecrawl), resume e enriquece a memória do lead.',
   'ferramenta',
   ARRAY['FIRECRAWL_API_KEY'],
   ARRAY['nina-enrich'],
   '{}'::jsonb,
   false, 2),
  ('tratamento-objecoes',
   'Tratamento de objeções',
   'Base de conhecimento para responder objeções comuns de forma consultiva.',
   'conhecimento',
   '{}',
   '{}',
   '{}'::jsonb,
   false, 3)
ON CONFLICT (slug) DO UPDATE SET
  name              = EXCLUDED.name,
  description       = EXCLUDED.description,
  level             = EXCLUDED.level,
  requires_secrets  = EXCLUDED.requires_secrets,
  requires_edge_fns = EXCLUDED.requires_edge_fns,
  config_schema     = EXCLUDED.config_schema,
  active_by_default = EXCLUDED.active_by_default,
  position          = EXCLUDED.position,
  updated_at        = now();
