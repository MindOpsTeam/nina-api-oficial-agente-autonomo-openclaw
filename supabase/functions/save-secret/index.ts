/**
 * POST /save-secret
 * Salva no Vault um secret fornecido pelo cliente. Generaliza o save-github-token.
 *
 * Auth: JWT do user.
 * Body: { name, value }
 * name DEVE estar no ALLOWLIST hardcoded (GITHUB_BRAIN_TOKEN, ANTHROPIC_API_KEY)
 * — o cliente não pode gravar segredo arbitrário no Vault.
 * Retorna: { ok: true } | { error }. Nunca ecoa o valor.
 *
 * Back-compat: a edge fn save-github-token continua funcionando (equivale a
 * save-secret com name=GITHUB_BRAIN_TOKEN); novas telas devem usar save-secret.
 */
import { adminClient, corsHeaders, errorResponse, jsonResponse } from "../_shared/panel.ts";
import { getJwtUser } from "../_shared/userauth.ts";

const ALLOWLIST = new Set(["GITHUB_BRAIN_TOKEN", "ANTHROPIC_API_KEY"]);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  const user = await getJwtUser(req);
  if (!user) return errorResponse("JWT inválido", 401);

  let body: { name?: string; value?: string };
  try {
    body = await req.json();
  } catch {
    return errorResponse("Body JSON inválido", 400);
  }

  const name = (body.name ?? "").trim();
  const value = (body.value ?? "").trim();

  if (!ALLOWLIST.has(name)) return errorResponse("name não permitido", 400);
  if (!value) return errorResponse("value obrigatório", 400);

  const admin = adminClient();
  const { error } = await admin.rpc("set_secret", { secret_name: name, secret_value: value });
  if (error) {
    console.error("[save-secret] set_secret error:", error.message);
    return errorResponse("Erro ao salvar o secret", 500);
  }

  return jsonResponse({ ok: true });
});
