// _shared/panel.ts
// Helpers do backbone de instâncias OpenClaw (F3a), replicando o padrão da
// carteira-do-agente. Auth VPS → app: header X-Panel-Token vs PANEL_TOKEN (Vault).
// Mantido separado de _shared/auth.ts (que usa outra convenção) — aditivo.

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSecret } from "./secrets.ts";

// Supabase admin client (service_role) — ignora RLS.
export function adminClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key, { auth: { persistSession: false } });
}

// Valida o header X-Panel-Token contra o PANEL_TOKEN do Vault (comparação em
// tempo constante). Fail-closed: sem header ou sem segredo configurado → false.
export async function validatePanelToken(req: Request): Promise<boolean> {
  const token = req.headers.get("X-Panel-Token");
  if (!token) return false;
  const expected = await getSecret("PANEL_TOKEN");
  if (!expected) return false;
  if (token.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < token.length; i++) {
    diff |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-panel-token, x-hooks-token",
};

export function errorResponse(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
