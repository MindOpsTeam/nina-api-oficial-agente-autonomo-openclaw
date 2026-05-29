/**
 * POST /secrets-status
 * Retorna SÓ a existência (booleano) dos secrets — nunca o valor — pra UI mostrar
 * 'configurado / não configurado'.
 *
 * Auth: JWT do user.
 * Body: {}
 * Retorna: { PANEL_TOKEN: bool, NINA_TOOLS_SECRET: bool, ANTHROPIC_API_KEY: bool, GITHUB_BRAIN_TOKEN: bool }.
 */
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/panel.ts";
import { getSecret } from "../_shared/secrets.ts";
import { getJwtUser } from "../_shared/userauth.ts";

const NAMES = ["PANEL_TOKEN", "NINA_TOOLS_SECRET", "ANTHROPIC_API_KEY", "GITHUB_BRAIN_TOKEN", "FIRECRAWL_API_KEY"] as const;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST" && req.method !== "GET") return errorResponse("Method not allowed", 405);

  const user = await getJwtUser(req);
  if (!user) return errorResponse("JWT inválido", 401);

  const status: Record<string, boolean> = {};
  for (const name of NAMES) {
    // getSecret retorna o valor server-side; só expomos o booleano de existência.
    status[name] = Boolean(await getSecret(name));
  }
  return jsonResponse(status);
});
