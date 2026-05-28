/**
 * POST /provision-secrets
 * Auto-provisiona os secrets internos do remix (Vault nasce vazio no remix).
 * IDEMPOTENTE: gera PANEL_TOKEN e NINA_TOOLS_SECRET só se ainda não existirem —
 * se já existem, NÃO regenera (não quebra VPS já conectada).
 *
 * Auth: JWT do user.
 * Body: {}
 * Retorna: { panel_token: 'created'|'exists', nina_tools_secret: 'created'|'exists' }.
 * NUNCA retorna os valores.
 */
import { adminClient, corsHeaders, errorResponse, jsonResponse } from "../_shared/panel.ts";
import { getSecret } from "../_shared/secrets.ts";
import { getJwtUser } from "../_shared/userauth.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// 32 bytes aleatórios em hex (= openssl rand -hex 32).
function genSecret(): string {
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

// Cria o secret só se ainda não existir no Vault. 'exists' não regenera.
async function ensureSecret(admin: SupabaseClient, name: string): Promise<"created" | "exists"> {
  const existing = await getSecret(name);
  if (existing) return "exists";
  const { error } = await admin.rpc("set_secret", { secret_name: name, secret_value: genSecret() });
  if (error) throw new Error(`set_secret(${name}): ${error.message}`);
  return "created";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  const user = await getJwtUser(req);
  if (!user) return errorResponse("JWT inválido", 401);

  const admin = adminClient();
  try {
    const panel = await ensureSecret(admin, "PANEL_TOKEN");
    const nina = await ensureSecret(admin, "NINA_TOOLS_SECRET");

    // Guarda a URL base do projeto no Vault (não é segredo aleatório — vem do env).
    // O cron do reaper (public.trigger_reaper) lê SUPABASE_URL + PANEL_TOKEN do
    // Vault em runtime pra montar o net.http_post sem nada hardcoded na migration.
    let supabaseUrl: "set" | "skipped" = "skipped";
    const url = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/+$/, "");
    if (url) {
      const { error } = await admin.rpc("set_secret", { secret_name: "SUPABASE_URL", secret_value: url });
      if (error) console.error("[provision-secrets] set SUPABASE_URL error:", error.message);
      else supabaseUrl = "set";
    }

    return jsonResponse({ panel_token: panel, nina_tools_secret: nina, supabase_url: supabaseUrl });
  } catch (e) {
    console.error("[provision-secrets] error:", (e as Error)?.message ?? e);
    return errorResponse("Erro ao provisionar secrets", 500);
  }
});
