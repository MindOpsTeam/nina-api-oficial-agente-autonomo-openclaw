import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  fetchSecretsStatus,
  readLocalSecretFlags,
  getLastSync,
  subscribeCerebroChanged,
  SECRET_NAMES,
  type SecretsStatus,
  type LastSync,
} from '@/services/cerebroService';

interface UseCerebroConfigResult {
  secrets: SecretsStatus;
  /** true se o secrets-status respondeu (fonte de verdade); false no gap de deploy. */
  statusAvailable: boolean;
  lastSync: LastSync | null;
  loading: boolean;
  /** Anthropic + GitHub PAT salvos. */
  keysReady: boolean;
  /** cérebro sincronizado ao menos 1x. */
  synced: boolean;
  /** libera o passo "Instalar na VPS". */
  installUnlocked: boolean;
  refresh: () => Promise<void>;
}

const emptyStatus = (): SecretsStatus =>
  SECRET_NAMES.reduce((acc, n) => ({ ...acc, [n]: false }), {} as SecretsStatus);

/**
 * Estado da jornada do /cerebro: agrega status dos secrets e o último sync para
 * decidir a ORDEM/trava dos passos (Chaves → Treinar/Sincronizar → Instalar).
 * Reage a mudanças (save de secret, sync) via event-bus do cerebroService.
 */
export function useCerebroConfig(): UseCerebroConfigResult {
  const { user } = useAuth();
  const [server, setServer] = useState<Partial<SecretsStatus>>({});
  const [statusAvailable, setStatusAvailable] = useState(false);
  const [localFlags, setLocalFlags] = useState<Partial<SecretsStatus>>(() => readLocalSecretFlags());
  const [lastSync, setLastSyncState] = useState<LastSync | null>(() => getLastSync());
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLocalFlags(readLocalSecretFlags());
    setLastSyncState(getLastSync());
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { status, available } = await fetchSecretsStatus();
    setServer(status);
    setStatusAvailable(available);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Reage a saves/sync disparados por outros componentes da jornada.
  useEffect(() => subscribeCerebroChanged(() => refresh()), [refresh]);

  const secrets = SECRET_NAMES.reduce((acc, name) => {
    acc[name] = statusAvailable ? !!server[name] : !!localFlags[name];
    return acc;
  }, {} as SecretsStatus) ?? emptyStatus();

  const keysReady = secrets.ANTHROPIC_API_KEY && secrets.GITHUB_BRAIN_TOKEN;
  const synced = !!lastSync;
  const installUnlocked = keysReady && synced;

  return { secrets, statusAvailable, lastSync, loading, keysReady, synced, installUnlocked, refresh };
}
