import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface CustomSkill {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  content: string;
  enabled: boolean;
}

export interface CustomSkillInput {
  name: string;
  description: string;
  content: string;
}

/** Limite por skill que o brain-build trunca (bytes). */
export const MAX_CONTENT_BYTES = 8192;

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,40}$/;

/** Gera slug compatível com o CHECK do banco: ^[a-z0-9][a-z0-9-]{1,40}$. */
export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // inválidos → hífen
    .replace(/-+/g, '-') // colapsa hífens
    .replace(/^-+|-+$/g, '') // trim hífens
    .slice(0, 41)
    .replace(/-+$/g, ''); // re-trim após o corte
}

export const isValidSlug = (s: string) => SLUG_RE.test(s);

function uniqueSlug(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  for (let i = 2; i < 1000; i++) {
    const suffix = `-${i}`;
    const trimmed = base.slice(0, 41 - suffix.length).replace(/-+$/g, '');
    const candidate = `${trimmed}${suffix}`;
    if (isValidSlug(candidate) && !taken.has(candidate)) return candidate;
  }
  return base;
}

interface UseCustomKnowledgeSkillsResult {
  skills: CustomSkill[];
  loading: boolean;
  error: string | null;
  changed: boolean;
  /** Retorna mensagem de erro (string) ou null em sucesso. */
  create: (input: CustomSkillInput) => Promise<string | null>;
  update: (id: string, patch: Partial<CustomSkillInput>) => Promise<string | null>;
  setEnabled: (id: string, enabled: boolean) => Promise<boolean>;
  remove: (id: string) => Promise<boolean>;
  refetch: () => Promise<void>;
}

const isUnique = (err: unknown) => (err as { code?: string })?.code === '23505';

/** CRUD das custom_knowledge_skills do owner (RLS por auth.uid()). */
export function useCustomKnowledgeSkills(): UseCustomKnowledgeSkillsResult {
  const { user } = useAuth();
  const [skills, setSkills] = useState<CustomSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [changed, setChanged] = useState(false);

  const fetchSkills = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const { data, error: qErr } = await supabase
        .from('custom_knowledge_skills')
        .select('id, slug, name, description, content, enabled')
        .order('created_at', { ascending: true });
      if (qErr) throw qErr;
      setSkills((data ?? []) as CustomSkill[]);
    } catch (err) {
      console.error('[useCustomKnowledgeSkills] Erro ao carregar:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar suas habilidades');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  const create = useCallback(
    async (input: CustomSkillInput): Promise<string | null> => {
      if (!user) return 'Sessão expirada.';
      const base = slugify(input.name);
      if (!isValidSlug(base)) return 'Dê um nome com ao menos 2 letras ou números.';
      const slug = uniqueSlug(base, new Set(skills.map((s) => s.slug)));

      try {
        const { error: insErr } = await supabase.from('custom_knowledge_skills').insert({
          owner_user_id: user.id,
          slug,
          name: input.name.trim(),
          description: input.description.trim() || null,
          content: input.content,
          enabled: true,
        });
        if (insErr) throw insErr;
        setChanged(true);
        await fetchSkills();
        return null;
      } catch (err) {
        console.error('[useCustomKnowledgeSkills] Erro ao criar:', err);
        if (isUnique(err)) return 'Já existe uma habilidade com esse nome.';
        return err instanceof Error ? err.message : 'Erro ao criar a habilidade.';
      }
    },
    [user, skills, fetchSkills],
  );

  const update = useCallback(
    async (id: string, patch: Partial<CustomSkillInput>): Promise<string | null> => {
      try {
        const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (patch.name !== undefined) payload.name = patch.name.trim();
        if (patch.description !== undefined) payload.description = patch.description.trim() || null;
        if (patch.content !== undefined) payload.content = patch.content;
        const { error: upErr } = await supabase
          .from('custom_knowledge_skills')
          .update(payload)
          .eq('id', id);
        if (upErr) throw upErr;
        setChanged(true);
        await fetchSkills();
        return null;
      } catch (err) {
        console.error('[useCustomKnowledgeSkills] Erro ao atualizar:', err);
        return err instanceof Error ? err.message : 'Erro ao atualizar a habilidade.';
      }
    },
    [fetchSkills],
  );

  const setEnabled = useCallback(
    async (id: string, enabled: boolean): Promise<boolean> => {
      setSkills((prev) => prev.map((s) => (s.id === id ? { ...s, enabled } : s))); // otimista
      try {
        const { error: upErr } = await supabase
          .from('custom_knowledge_skills')
          .update({ enabled, updated_at: new Date().toISOString() })
          .eq('id', id);
        if (upErr) throw upErr;
        setChanged(true);
        return true;
      } catch (err) {
        console.error('[useCustomKnowledgeSkills] Erro no toggle:', err);
        await fetchSkills();
        return false;
      }
    },
    [fetchSkills],
  );

  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const { error: delErr } = await supabase.from('custom_knowledge_skills').delete().eq('id', id);
        if (delErr) throw delErr;
        setChanged(true);
        await fetchSkills();
        return true;
      } catch (err) {
        console.error('[useCustomKnowledgeSkills] Erro ao excluir:', err);
        return false;
      }
    },
    [fetchSkills],
  );

  return { skills, loading, error, changed, create, update, setEnabled, remove, refetch: fetchSkills };
}
