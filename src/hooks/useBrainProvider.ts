import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type BrainProvider = 'lovable' | 'openclaw';

interface UseBrainProviderResult {
  provider: BrainProvider;
  loading: boolean;
  saving: boolean;
  error: string | null;
  setProvider: (next: BrainProvider) => Promise<boolean>;
  refetch: () => Promise<void>;
}

/**
 * Lê e atualiza `nina_settings.brain_provider`.
 * Segue o padrão single-tenant do projeto: registro global único (sem filtro por user).
 */
export function useBrainProvider(): UseBrainProviderResult {
  const { user } = useAuth();
  const [provider, setProviderState] = useState<BrainProvider>('lovable');
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProvider = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: queryError } = await supabase
        .from('nina_settings')
        .select('id, brain_provider')
        .limit(1)
        .maybeSingle();

      if (queryError) throw queryError;

      if (data) {
        setSettingsId(data.id);
        setProviderState(data.brain_provider === 'openclaw' ? 'openclaw' : 'lovable');
      }
    } catch (err) {
      console.error('[useBrainProvider] Erro ao carregar provedor:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar cérebro ativo');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchProvider();
  }, [fetchProvider]);

  const setProvider = useCallback(
    async (next: BrainProvider): Promise<boolean> => {
      if (!settingsId) {
        setError('Configurações da Nina não encontradas');
        return false;
      }

      const previous = provider;
      setSaving(true);
      setProviderState(next); // otimista

      try {
        const { error: updateError } = await supabase
          .from('nina_settings')
          .update({ brain_provider: next, updated_at: new Date().toISOString() })
          .eq('id', settingsId);

        if (updateError) throw updateError;
        return true;
      } catch (err) {
        console.error('[useBrainProvider] Erro ao salvar provedor:', err);
        setProviderState(previous); // rollback
        setError(err instanceof Error ? err.message : 'Erro ao alterar o cérebro ativo');
        return false;
      } finally {
        setSaving(false);
      }
    },
    [settingsId, provider]
  );

  return { provider, loading, saving, error, setProvider, refetch: fetchProvider };
}
