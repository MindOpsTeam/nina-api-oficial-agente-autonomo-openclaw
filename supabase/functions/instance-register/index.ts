/**
 * POST /instance-register
 * Registra/atualiza a instância VPS OpenClaw que se auto-registra no app.
 * Upsert por (owner_user_id, hostname) — multi-tenant owner-scoped.
 *
 * Auth: X-Panel-Token. + installer_token (obrigatório) que define o dono.
 * Body: { hostname, installer_token, openclaw_version, ingress_url, hooks_token,
 *         openclaw_dashboard_token, agent_type }
 * Retorna: { instance_id }
 *
 * DECISÃO (multi-tenant + segurança): o PANEL_TOKEN é global (não identifica o
 * dono). Como instances é owner-scoped, o dono vem EXCLUSIVAMENTE de um
 * installer_token válido (existe / não-expirado / não-usado), gerado em
 * onboarding-issue-token e carregado pela VPS na instalação. NÃO aceitamos
 * owner_user_id cru do body: senão qualquer detentor do PANEL_TOKEN poderia
 * registrar/sobrescrever a instância de outro dono via upsert (hijack de
 * roteamento na F3c). O installer (setup-nina.sh, F3b) sempre envia o token.
 */
import {
  adminClient,
  corsHeaders,
  errorResponse,
  jsonResponse,
  validatePanelToken,
} from "../_shared/panel.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);
  if (!(await validatePanelToken(req))) return errorResponse("Token inválido", 401);

  let body: {
    hostname?: string;
    openclaw_version?: string;
    ingress_url?: string;
    hooks_token?: string;
    openclaw_dashboard_token?: string;
    agent_type?: string;
    installer_token?: string;
  };
  try {
    body = await req.json();
  } catch {
    return errorResponse("Body JSON inválido", 400);
  }

  if (!body.hostname) return errorResponse("hostname obrigatório", 400);
  if (!body.installer_token) return errorResponse("installer_token obrigatório", 403);

  const supabase = adminClient();

  // Owner resolvido EXCLUSIVAMENTE por um installer_token válido (one-time).
  const { data: tok } = await supabase
    .from("installer_tokens")
    .select("owner_user_id, expires_at, used_at")
    .eq("token", body.installer_token)
    .maybeSingle();
  if (!tok) return errorResponse("installer_token inválido", 403);
  if (tok.used_at) return errorResponse("installer_token já utilizado", 403);
  if (tok.expires_at && new Date(tok.expires_at) < new Date()) {
    return errorResponse("installer_token expirado", 403);
  }

  const ownerUserId = tok.owner_user_id;
  await supabase
    .from("installer_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("token", body.installer_token);

  const upsertData = {
    owner_user_id: ownerUserId,
    hostname: body.hostname,
    openclaw_version: body.openclaw_version ?? null,
    ingress_url: body.ingress_url ?? null,
    hooks_token: body.hooks_token ?? null,
    openclaw_dashboard_token: body.openclaw_dashboard_token ?? null,
    agent_type: body.agent_type ?? "nina_sdr",
    last_heartbeat: new Date().toISOString(),
    status: "online",
  };

  const { data: instance, error } = await supabase
    .from("instances")
    .upsert(upsertData, { onConflict: "owner_user_id,hostname", ignoreDuplicates: false })
    .select("id")
    .single();

  if (error || !instance) {
    console.error("[instance-register] upsert error:", error);
    return errorResponse("Erro ao registrar instância", 500);
  }

  return jsonResponse({ instance_id: instance.id });
});
