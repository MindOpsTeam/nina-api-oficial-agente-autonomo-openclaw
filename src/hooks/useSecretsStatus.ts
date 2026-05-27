import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type SecretName = 'PANEL_TOKEN' | 'NINA_TOOLS_SECRET' | 'GITHUB_BRAIN_TOKEN' | 'ANTHROPIC_API_KEY';

export const SECRET_NAMES: SecretName[] = [
  'PANEL_TOKEN',
  'NINA_TOOLS_SECRET',
  'GITHUB_BRAIN_TOKEN',
  'ANTHROPIC_API_KEY',
];

export type SecretsStatus = Record<SecretName, boolean>;

const flagKey = (name: SecretName) => `nina_secret_${name}`;

const truthy = (v: unknown): boolean =>
  v === true ||
  v === 'true' ||
  (typeof v === 'object' && v !== null && (v as { exists?: unknown }).exists === true);

/** Normaliza respostas possíveis do secrets-status ({...} ou { secrets: {...} }). */
function normalize(data: unknown): Partial<SecretsStatus> {
  const src = ((data as { secrets?: unknown })?.secrets ?? data ?? {}) as Record<string, unknown>;
  const out: Partial<SecretsStatus> = {};
  for (const name of SECRET_NAMES) out[name] = truthy(src[name]);
  return out;
}

interface UseSecretsStatusResult {
  /** Status final por secret (servidor quando disponível; senão flag local pós-save). */
  status: SecretsStatus;
  /** true se o secrets-status respondeu (fonte de verdade); false durante o gap de deploy. */
  statusAvailable: boolean;
  loading: boolean;
  refetch: () => Promise<void>;
  /** Marca um secret como salvo localmente (fallback enquanto secrets-status não está no ar). */
  recordSaved: (name: SecretName) => void;
}

const readLocalFlags = (): Partial<SecretsStatus> => {
  const out: Partial<SecretsStatus> = {};
  if (typeof window === 'undefined') return out;
  for (const name of SECRET_NAMES) out[name] = window.localStorage.getItem(flagKey(name)) === 'true';
  return out;
};

/**
 * Status de existência dos 4 secrets via edge fn secrets-status (NUNCA expõe valores).
 * Com fallback em localStorage para o período em que a fn ainda não está deployada.
 */
export function useSecretsStatus(): UseSecretsStatusResult {
  const { user } = useAuth();
  const [server, setServer] = useState<Partial<SecretsStatus> | null>(null);
  const [statusAvailable, setStatusAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [localFlags, setLocalFlags] = useState<Partial<SecretsStatus>>(() => readLocalFlags());

  const refetch = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('secrets-status');
      if (error) throw error;
      setServer(normalize(data));
      setStatusAvailable(true);
    } catch (err) {
      // fn ainda não deployada ou erro: cai no fallback local, sem quebrar a UI.
      console.warn('[useSecretsStatus] secrets-status indisponível, usando fallback local:', err);
      setStatusAvailable(false);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const recordSaved = useCallback((name: SecretName) => {
    if (typeof window !== 'undefined') window.localStorage.setItem(flagKey(name), 'true');
    setLocalFlags((f) => ({ ...f, [name]: true }));
  }, []);

  const status = SECRET_NAMES.reduce((acc, name) => {
    acc[name] = statusAvailable && server ? !!server[name] : !!localFlags[name];
    return acc;
  }, {} as SecretsStatus);

  return { status, statusAvailable, loading, refetch, recordSaved };
}
