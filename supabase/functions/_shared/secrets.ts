// _shared/secrets.ts
// Lê segredos do Supabase Vault via a RPC SECURITY DEFINER public.get_secret
// (restrita a service_role). Cache em memória (TTL ~5min) para não bater no
// banco a cada request. Fallback: Deno.env.get(name) se o Vault não retornar.
//
// O segredo nunca é exposto ao cliente: a RPC só roda com service-role e o valor
// fica no processo da Edge Function.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { value: string; exp: number }>();

export async function getSecret(name: string): Promise<string | undefined> {
  const now = Date.now();
  const cached = cache.get(name);
  if (cached && cached.exp > now) return cached.value;

  // 1) Vault via RPC (service-role).
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (url && serviceKey) {
      const client = createClient(url, serviceKey, { auth: { persistSession: false } });
      const { data, error } = await client.rpc("get_secret", { secret_name: name });
      if (error) {
        console.error(`[secrets] get_secret(${name}) rpc error:`, error.message);
      } else if (data) {
        const value = String(data);
        if (value) {
          cache.set(name, { value, exp: now + TTL_MS });
          return value;
        }
      }
    }
  } catch (e) {
    console.error(`[secrets] getSecret(${name}) exception:`, (e as Error)?.message ?? e);
  }

  // 2) Fallback: variável de ambiente.
  const envVal = Deno.env.get(name);
  if (envVal) {
    cache.set(name, { value: envVal, exp: now + TTL_MS });
    return envVal;
  }

  return undefined;
}
