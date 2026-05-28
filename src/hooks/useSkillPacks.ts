import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { Json } from '@/integrations/supabase/types';

export type PackConfig = Record<string, number | string | boolean>;

export interface SkillPack {
  slug: string;
  name: string;
  description: string | null;
  level: string;
  requires_secrets: string[];
  requires_edge_fns: string[];
  config_schema: PackConfig;
  position: number;
  /** Estado do owner (de installed_packs); reflete o que o brain-build renderiza. */
  enabled: boolean;
  config: PackConfig;
}

interface UseSkillPacksResult {
  packs: SkillPack[];
  loading: boolean;
  error: string | null;
  /** true se o usuário alterou algum pack nesta sessão (nudge para sincronizar). */
  changed: boolean;
  setEnabled: (slug: string, enabled: boolean) => Promise<boolean>;
  setConfig: (slug: string, config: PackConfig) => Promise<boolean>;
  refetch: () => Promise<void>;
}

const asObject = (v: unknown): PackConfig =>
  typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as PackConfig) : {};

/**
 * Catálogo de skill_packs + estado por dono (installed_packs).
 * O estado refletido é o de installed_packs — a mesma fonte que o brain-build lê.
 */
export function useSkillPacks(): UseSkillPacksResult {
  const { user } = useAuth();
  const [packs, setPacks] = useState<SkillPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [changed, setChanged] = useState(false);

  const fetchPacks = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);

      const [catalogRes, installedRes] = await Promise.all([
        supabase
          .from('skill_packs')
          .select('slug, name, description, level, requires_secrets, requires_edge_fns, config_schema, position')
          .order('position', { ascending: true }),
        supabase.from('installed_packs').select('pack_slug, enabled, config'),
      ]);

      if (catalogRes.error) throw catalogRes.error;
      if (installedRes.error) throw installedRes.error;

      const installedBySlug = new Map(
        (installedRes.data ?? []).map((r) => [r.pack_slug, r]),
      );

      const merged: SkillPack[] = (catalogRes.data ?? []).map((p) => {
        const installed = installedBySlug.get(p.slug);
        return {
          slug: p.slug,
          name: p.name,
          description: p.description,
          level: p.level,
          requires_secrets: p.requires_secrets ?? [],
          requires_edge_fns: p.requires_edge_fns ?? [],
          config_schema: asObject(p.config_schema),
          position: p.position,
          enabled: installed?.enabled ?? false,
          config: { ...asObject(p.config_schema), ...asObject(installed?.config) },
        };
      });

      setPacks(merged);
    } catch (err) {
      console.error('[useSkillPacks] Erro ao carregar:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar habilidades');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchPacks();
  }, [fetchPacks]);

  const upsert = useCallback(
    async (slug: string, patch: { enabled?: boolean; config?: PackConfig }): Promise<boolean> => {
      if (!user) return false;
      const current = packs.find((p) => p.slug === slug);
      const enabled = patch.enabled ?? current?.enabled ?? false;
      const config = patch.config ?? current?.config ?? {};

      // Otimista.
      setPacks((prev) => prev.map((p) => (p.slug === slug ? { ...p, enabled, config } : p)));

      try {
        const { error: upErr } = await supabase
          .from('installed_packs')
          .upsert(
            {
              owner_user_id: user.id,
              pack_slug: slug,
              enabled,
              config: config as unknown as Json,
            },
            { onConflict: 'owner_user_id,pack_slug' },
          );
        if (upErr) throw upErr;
        setChanged(true);
        return true;
      } catch (err) {
        console.error('[useSkillPacks] Erro ao salvar pack:', err);
        await fetchPacks(); // rollback para o estado real
        setError(err instanceof Error ? err.message : 'Erro ao salvar habilidade');
        return false;
      }
    },
    [user, packs, fetchPacks],
  );

  const setEnabled = useCallback((slug: string, enabled: boolean) => upsert(slug, { enabled }), [upsert]);
  const setConfig = useCallback((slug: string, config: PackConfig) => upsert(slug, { config }), [upsert]);

  return { packs, loading, error, changed, setEnabled, setConfig, refetch: fetchPacks };
}
