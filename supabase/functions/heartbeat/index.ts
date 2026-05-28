/**
 * POST /heartbeat
 * Atualiza o ciclo de vida da instância: last_heartbeat=now(), status='online',
 * e (se enviados) ingress_url, system_prompt, openclaw_version.
 *
 * Auth: X-Panel-Token.
 * Body: { instance_id, ingress_url?, system_prompt?, openclaw_version? }
 * Retorna: 200 { anthropic_api_key } — a chave ATUAL do Vault, pra a VPS aplicar
 * via self-heal (heartbeat.sh atualiza o .env + reinicia o gateway só quando
 * mudou). SEGURANÇA: a chave trafega sobre HTTPS e a rota é autenticada por
 * X-Panel-Token (mesmo nível de confiança da entrega no install via setup-installer).
 */
import {
  adminClient,
  corsHeaders,
  errorResponse,
  jsonResponse,
  validatePanelToken,
} from "../_shared/panel.ts";
import { getSecret } from "../_shared/secrets.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);
  if (!(await validatePanelToken(req))) return errorResponse("Token inválido", 401);

  let body: {
    instance_id?: string;
    ingress_url?: string;
    system_prompt?: string;
    openclaw_version?: string;
  };
  try {
    body = await req.json();
  } catch {
    return errorResponse("Body JSON inválido", 400);
  }

  if (!body.instance_id) return errorResponse("instance_id obrigatório", 400);

  const updateData: Record<string, unknown> = {
    last_heartbeat: new Date().toISOString(),
    status: "online",
  };
  if (body.ingress_url) updateData.ingress_url = body.ingress_url;
  if (body.system_prompt !== undefined) updateData.system_prompt = body.system_prompt;
  if (body.openclaw_version) updateData.openclaw_version = body.openclaw_version;

  const supabase = adminClient();
  const { error } = await supabase
    .from("instances")
    .update(updateData)
    .eq("id", body.instance_id);

  if (error) {
    console.error("[heartbeat] update error:", error);
    return errorResponse("Erro ao atualizar heartbeat", 500);
  }

  // Devolve a ANTHROPIC_API_KEY atual do Vault pra a VPS aplicar via self-heal.
  // Rota autenticada por X-Panel-Token (ver cabeçalho). Vazio se ainda não configurada.
  const anthropicKey = (await getSecret("ANTHROPIC_API_KEY")) ?? "";
  return jsonResponse({ anthropic_api_key: anthropicKey });
});
