/**
 * POST /instance-register
 * Registra/atualiza a instância VPS OpenClaw que se auto-registra no app.
 * Upsert por (owner_user_id, hostname) — multi-tenant owner-scoped.
 *
 * Auth: X-Panel-Token.
 * Body: { hostname, openclaw_version, ingress_url, hooks_token,
 *         openclaw_dashboard_token, agent_type, installer_token?, owner_user_id? }
 * Retorna: { instance_id }
 *
 * DECISÃO (multi-tenant): o PANEL_TOKEN é global (não identifica o dono). Como a
 * tabela instances é owner-scoped, o vínculo do dono vem do installer_token
 * gerado em onboarding-issue-token e carregado pela VPS no momento da instalação.
 * Ordem de resolução do owner: installer_token (preferido, marca used_at) →
 * owner_user_id explícito → dono de uma instância já existente com o mesmo hostname.
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
  if (!validatePanelToken(req)) return errorResponse("Token inválido", 401);

  let body: {
    hostname?: string;
    openclaw_version?: string;
    ingress_url?: string;
    hooks_token?: string;
    openclaw_dashboard_token?: string;
    agent_type?: string;
    installer_token?: string;
    owner_user_id?: string;
  };
  try {
    body = await req.json();
  } catch {
    return errorResponse("Body JSON inválido", 400);
  }

  if (!body.hostname) return errorResponse("hostname obrigatório", 400);

  const supabase = adminClient();

  // Resolve o owner do registro.
  let ownerUserId: string | null = null;

  if (body.installer_token) {
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
    ownerUserId = tok.owner_user_id;
    await supabase
      .from("installer_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("token", body.installer_token);
  } else if (body.owner_user_id) {
    ownerUserId = body.owner_user_id;
  } else {
    // Re-registro sem token: reaproveita o dono da instância existente com esse hostname.
    const { data: existing } = await supabase
      .from("instances")
      .select("owner_user_id")
      .eq("hostname", body.hostname)
      .limit(1)
      .maybeSingle();
    ownerUserId = existing?.owner_user_id ?? null;
  }

  if (!ownerUserId) {
    return errorResponse("Não foi possível resolver o owner (envie installer_token ou owner_user_id)", 400);
  }

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
