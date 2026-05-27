import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

/**
 * Janela (ms) dentro da qual um heartbeat é considerado "fresco" => instância ONLINE.
 */
export const HEARTBEAT_ONLINE_WINDOW_MS = 10 * 60 * 1000; // 10 min

/**
 * Intervalo de auto-refresh do status da instância.
 */
export const INSTANCE_POLL_INTERVAL_MS = 15 * 1000; // 15s

export type InstanceStatus = 'unregistered' | 'registered' | 'online' | 'offline';

/**
 * Subconjunto SEGURO de colunas de `instances`.
 * NUNCA selecionamos hooks_token / openclaw_dashboard_token (segredos não vão ao client).
 */
export interface InstanceInfo {
  id: string;
  hostname: string | null;
  ingress_url: string | null;
  status: string;
  last_heartbeat: string | null;
  openclaw_version: string | null;
  agent_type: string;
}

const SAFE_COLUMNS = 'id, hostname, ingress_url, status, last_heartbeat, openclaw_version, agent_type';

export function computeInstanceStatus(instance: InstanceInfo | null): InstanceStatus {
  if (!instance) return 'unregistered';
  if (!instance.last_heartbeat) return 'registered';
  const ageMs = Date.now() - new Date(instance.last_heartbeat).getTime();
  return ageMs <= HEARTBEAT_ONLINE_WINDOW_MS ? 'online' : 'offline';
}

interface UseInstanceResult {
  instance: InstanceInfo | null;
  status: InstanceStatus;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Carrega a instância OpenClaw do usuário (RLS owner-scoped) e re-deriva o status
 * a cada `INSTANCE_POLL_INTERVAL_MS` para refletir o frescor do heartbeat.
 */
export function useInstance(): UseInstanceResult {
  const { user } = useAuth();
  const [instance, setInstance] = useState<InstanceInfo | null>(null);
  const [status, setStatus] = useState<InstanceStatus>('unregistered');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isFirstLoad = useRef(true);

  const fetchInstance = useCallback(async () => {
    if (!user) {
      setInstance(null);
      setStatus('unregistered');
      setLoading(false);
      return;
    }

    try {
      if (isFirstLoad.current) setLoading(true);
      setError(null);

      // RLS limita ao owner; pega a instância com heartbeat mais recente.
      const { data, error: queryError } = await supabase
        .from('instances')
        .select(SAFE_COLUMNS)
        .order('last_heartbeat', { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();

      if (queryError) throw queryError;

      const info = (data as InstanceInfo | null) ?? null;
      setInstance(info);
      setStatus(computeInstanceStatus(info));
    } catch (err) {
      console.error('[useInstance] Erro ao carregar instância:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar instância');
    } finally {
      isFirstLoad.current = false;
      setLoading(false);
    }
  }, [user]);

  // Carga inicial + polling.
  useEffect(() => {
    isFirstLoad.current = true;
    fetchInstance();
    const intervalId = setInterval(fetchInstance, INSTANCE_POLL_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [fetchInstance]);

  // Re-deriva o status localmente entre polls (heartbeat "envelhece" sem refetch).
  useEffect(() => {
    const tick = setInterval(() => {
      setStatus(computeInstanceStatus(instance));
    }, INSTANCE_POLL_INTERVAL_MS);
    return () => clearInterval(tick);
  }, [instance]);

  return { instance, status, loading, error, refetch: fetchInstance };
}
