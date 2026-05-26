/**
 * POST /onboarding-issue-token
 * Auth: JWT do user. Gera um token one-time (expira 30min) salvo em
 * installer_tokens e retorna o token + a URL/comando de instalação do OpenClaw.
 */
import { adminClient, corsHeaders, errorResponse, jsonResponse } from "../_shared/panel.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function genToken(): string {
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return errorResponse("Auth obrigatória", 401);

  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: uErr } = await userClient.auth.getUser();
  if (uErr || !user) return errorResponse("JWT inválido", 401);

  const token = genToken();
  const admin = adminClient();
  const { error } = await admin.from("installer_tokens").insert({
    token,
    owner_user_id: user.id,
  });
  if (error) {
    console.error("[onboarding-issue-token] insert error:", error);
    return errorResponse(error.message, 500);
  }

  const baseUrl = Deno.env.get("SUPABASE_URL")!;
  const installerUrl = `${baseUrl}/functions/v1/setup-installer?token=${token}`;
  const installCommand = `curl -fsSL "${installerUrl}" | bash`;

  return jsonResponse({
    token,
    installer_url: installerUrl,
    install_command: installCommand,
    expires_in_minutes: 30,
  });
});
