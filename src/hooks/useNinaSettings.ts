import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { Json } from '@/integrations/supabase/types';

/**
 * Campos livres do "cérebro" da Nina, guardados em nina_settings.brain_identity (jsonb).
 */
export interface BrainIdentity {
  empresa_missao?: string;
  empresa_tagline?: string;
  fundadores?: string;
  prova_social?: string;
  tom?: string;
  guardrails?: string;
  publico_alvo?: string;
}

export interface NinaSettingsForm {
  company_name: string;
  sdr_name: string;
  system_prompt_override: string;
  brain_repo_url: string;
  brain_identity: BrainIdentity;
}

const EMPTY: NinaSettingsForm = {
  company_name: '',
  sdr_name: '',
  system_prompt_override: '',
  brain_repo_url: '',
  brain_identity: {},
};

interface UseNinaSettingsResult {
  settingsId: string | null;
  values: NinaSettingsForm;
  loading: boolean;
  saving: boolean;
  error: string | null;
  save: (patch: Partial<NinaSettingsForm>) => Promise<boolean>;
  refetch: () => Promise<void>;
}

/**
 * Lê/grava a linha global de nina_settings (padrão single-tenant do projeto).
 * Concentra os campos editados pela seção "Treinar a Nina".
 */
export function useNinaSettings(): UseNinaSettingsResult {
  const { user } = useAuth();
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [values, setValues] = useState<NinaSettingsForm>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);

      const { data, error: queryError } = await supabase
        .from('nina_settings')
        .select('id, company_name, sdr_name, system_prompt_override, brain_repo_url, brain_identity')
        .limit(1)
        .maybeSingle();

      if (queryError) throw queryError;

      if (data) {
        setSettingsId(data.id);
        const identity = (data.brain_identity ?? {}) as BrainIdentity;
        setValues({
          company_name: data.company_name ?? '',
          sdr_name: data.sdr_name ?? '',
          system_prompt_override: data.system_prompt_override ?? '',
          brain_repo_url: data.brain_repo_url ?? '',
          brain_identity: typeof identity === 'object' && identity !== null ? identity : {},
        });
      }
    } catch (err) {
      console.error('[useNinaSettings] Erro ao carregar:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const save = useCallback(
    async (patch: Partial<NinaSettingsForm>): Promise<boolean> => {
      if (!settingsId) {
        setError('Configurações da Nina não encontradas');
        return false;
      }
      setSaving(true);
      try {
        const next = { ...values, ...patch };
        const { error: updateError } = await supabase
          .from('nina_settings')
          .update({
            company_name: next.company_name || null,
            sdr_name: next.sdr_name || null,
            system_prompt_override: next.system_prompt_override || null,
            brain_repo_url: next.brain_repo_url || null,
            brain_identity: next.brain_identity as unknown as Json,
            updated_at: new Date().toISOString(),
          })
          .eq('id', settingsId);

        if (updateError) throw updateError;
        setValues(next);
        return true;
      } catch (err) {
        console.error('[useNinaSettings] Erro ao salvar:', err);
        setError(err instanceof Error ? err.message : 'Erro ao salvar');
        return false;
      } finally {
        setSaving(false);
      }
    },
    [settingsId, values]
  );

  return { settingsId, values, loading, saving, error, save, refetch: fetchSettings };
}
