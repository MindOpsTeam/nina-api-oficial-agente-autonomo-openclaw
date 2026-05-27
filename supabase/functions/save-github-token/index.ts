/**
 * POST /save-github-token
 * Salva o PAT do GitHub do cliente no Vault como GITHUB_BRAIN_TOKEN.
 *
 * A RPC public.set_secret é EXECUTE-only-service_role (o cliente authenticated
 * não pode chamá-la direto). Esta edge fn valida o JWT do user e chama a RPC
 * com a service-role key. O nome do secret é HARDCODED — o body NÃO controla
 * qual segredo é escrito (evita gravar segredo arbitrário no Vault).
 *
 * Auth: JWT do user.
 * Body: { value: '<PAT>' }
 * Retorna: { ok: true } | { error }. Nunca ecoa o valor.
 */
import { adminClient, corsHeaders, errorResponse, jsonResponse } from "../_shared/panel.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SECRET_NAME = "GITHUB_BRAIN_TOKEN"; // hardcoded — body não escolhe o nome

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  // Auth: JWT do user.
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return errorResponse("Auth obrigatória", 401);
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error: uErr } = await userClient.auth.getUser();
  if (uErr || !user) return errorResponse("JWT inválido", 401);

  let body: { value?: string };
  try {
    body = await req.json();
  } catch {
    return errorResponse("Body JSON inválido", 400);
  }

  const value = (body.value ?? "").trim();
  if (!value) return errorResponse("value obrigatório", 400);

  // Grava no Vault via RPC service-role (nome hardcoded).
  const admin = adminClient();
  const { error } = await admin.rpc("set_secret", { secret_name: SECRET_NAME, secret_value: value });
  if (error) {
    console.error("[save-github-token] set_secret error:", error.message);
    return errorResponse("Erro ao salvar o token", 500);
  }

  return jsonResponse({ ok: true });
});
