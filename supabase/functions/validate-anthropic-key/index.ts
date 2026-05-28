/**
 * POST /validate-anthropic-key   (autenticada — user JWT)
 * Valida a ANTHROPIC_API_KEY do Vault com uma chamada MÍNIMA à Anthropic
 * (POST /v1/messages, max_tokens:1), para a aba "Chaves" do /cerebro avisar na
 * hora se a chave está errada.
 *
 * Resposta JSON: { ok: boolean, error?: string }
 *   - 401 da Anthropic        -> ok:false, error:'chave_invalida'
 *   - qualquer outro status   -> ok:true  (a auth passou; 400/404/429 são
 *                                 problemas de request/modelo/limite, não de chave)
 * NUNCA retorna nem loga a chave.
 */
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/panel.ts";
import { getSecret } from "../_shared/secrets.ts";
import { getJwtUser } from "../_shared/userauth.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  const user = await getJwtUser(req);
  if (!user) return errorResponse("Auth obrigatória", 401);

  const key = await getSecret("ANTHROPIC_API_KEY");
  if (!key) return jsonResponse({ ok: false, error: "chave_nao_configurada (ANTHROPIC_API_KEY ausente no Vault)" });

  let resp: Response;
  try {
    resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1,
        messages: [{ role: "user", content: "ping" }],
      }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (_e) {
    return jsonResponse({ ok: false, error: "erro_rede (não foi possível contatar a Anthropic)" });
  }

  // A Anthropic valida a autenticação ANTES do request (401 = chave inválida).
  // Qualquer status != 401 significa que a chave autenticou.
  if (resp.status === 401) {
    return jsonResponse({ ok: false, error: "chave_invalida" });
  }
  return jsonResponse({ ok: true });
});
