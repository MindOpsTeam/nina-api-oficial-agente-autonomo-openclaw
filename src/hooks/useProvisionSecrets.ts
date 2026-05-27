import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

type ProvisionPhase = 'idle' | 'provisioning' | 'done' | 'error';

interface UseProvisionSecretsResult {
  phase: ProvisionPhase;
  provisioned: boolean;
}

/**
 * Auto-provisiona os secrets internos (PANEL_TOKEN + NINA_TOOLS_SECRET) ao abrir o /cerebro.
 * Chamada SILENCIOSA e idempotente: o remix nasce pronto. Falha não alarma o usuário.
 */
export function useProvisionSecrets(): UseProvisionSecretsResult {
  const { user } = useAuth();
  const [phase, setPhase] = useState<ProvisionPhase>('idle');
  const ran = useRef(false);

  useEffect(() => {
    if (!user || ran.current) return;
    ran.current = true;

    (async () => {
      setPhase('provisioning');
      try {
        const { error } = await supabase.functions.invoke('provision-secrets');
        if (error) throw error;
        setPhase('done');
      } catch (err) {
        // Idempotente e não-crítico: registra e segue (não bloqueia a tela).
        console.warn('[useProvisionSecrets] provision-secrets indisponível:', err);
        setPhase('error');
      }
    })();
  }, [user]);

  return { phase, provisioned: phase === 'done' };
}
