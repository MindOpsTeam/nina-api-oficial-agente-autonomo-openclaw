import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface BrainKnowledge {
  id: string;
  title: string;
  slug: string;
  content_md: string;
  position: number;
}

export type BrainKnowledgeInput = Pick<BrainKnowledge, 'title' | 'slug' | 'content_md'>;

interface UseBrainKnowledgeResult {
  entries: BrainKnowledge[];
  loading: boolean;
  error: string | null;
  create: (input: BrainKnowledgeInput) => Promise<boolean>;
  update: (id: string, patch: Partial<BrainKnowledgeInput>) => Promise<boolean>;
  remove: (id: string) => Promise<boolean>;
  refetch: () => Promise<void>;
}

/** Gera um slug a partir do título (minúsculo, sem acento, hifenizado). */
export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** CRUD de brain_knowledge (RLS owner-scoped; slug único por owner). */
export function useBrainKnowledge(): UseBrainKnowledgeResult {
  const { user } = useAuth();
  const [entries, setEntries] = useState<BrainKnowledge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEntries = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const { data, error: queryError } = await supabase
        .from('brain_knowledge')
        .select('id, title, slug, content_md, position')
        .order('position', { ascending: true })
        .order('created_at', { ascending: true });

      if (queryError) throw queryError;
      setEntries((data ?? []) as BrainKnowledge[]);
    } catch (err) {
      console.error('[useBrainKnowledge] Erro ao carregar:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar conhecimento');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const isDuplicateSlug = (err: unknown) =>
    typeof (err as { code?: string })?.code === 'string' &&
    (err as { code: string }).code === '23505';

  const create = useCallback(
    async (input: BrainKnowledgeInput): Promise<boolean> => {
      try {
        const position = entries.length;
        const { error: insertError } = await supabase
          .from('brain_knowledge')
          .insert({ ...input, position });
        if (insertError) throw insertError;
        await fetchEntries();
        return true;
      } catch (err) {
        console.error('[useBrainKnowledge] Erro ao criar:', err);
        setError(isDuplicateSlug(err) ? 'Já existe um item com esse slug' : err instanceof Error ? err.message : 'Erro ao criar item');
        return false;
      }
    },
    [entries.length, fetchEntries]
  );

  const update = useCallback(
    async (id: string, patch: Partial<BrainKnowledgeInput>): Promise<boolean> => {
      try {
        const { error: updateError } = await supabase
          .from('brain_knowledge')
          .update({ ...patch, updated_at: new Date().toISOString() })
          .eq('id', id);
        if (updateError) throw updateError;
        await fetchEntries();
        return true;
      } catch (err) {
        console.error('[useBrainKnowledge] Erro ao atualizar:', err);
        setError(isDuplicateSlug(err) ? 'Já existe um item com esse slug' : err instanceof Error ? err.message : 'Erro ao atualizar item');
        return false;
      }
    },
    [fetchEntries]
  );

  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const { error: deleteError } = await supabase.from('brain_knowledge').delete().eq('id', id);
        if (deleteError) throw deleteError;
        await fetchEntries();
        return true;
      } catch (err) {
        console.error('[useBrainKnowledge] Erro ao remover:', err);
        setError(err instanceof Error ? err.message : 'Erro ao remover item');
        return false;
      }
    },
    [fetchEntries]
  );

  return { entries, loading, error, create, update, remove, refetch: fetchEntries };
}
