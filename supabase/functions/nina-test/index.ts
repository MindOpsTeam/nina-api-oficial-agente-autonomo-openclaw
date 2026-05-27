/**
 * POST /nina-test
 * Sandbox SÍNCRONO do /cerebro: manda uma mensagem pro OpenClaw do próprio
 * usuário e devolve a resposta real da Nina (com latência), SEM jamais enviar
 * pra um WhatsApp real.
 *
 * Auth: JWT do user.
 * Body: { message }
 * Retorna: { content, latency_ms, status } | { error }.
 *
 * SEGURANÇA (anti-envio): o run usa run_id com prefixo 'test-'. A nina-reply
 * detecta esse prefixo e grava a resposta na tabela nina_test_results — NUNCA
 * no send_queue. Como o whatsapp-sender só lê send_queue, a resposta de teste
 * é impossível de ser enviada. Não cria contact/conversation reais.
 */
import { adminClient, corsHeaders, errorResponse, jsonResponse } from "../_shared/panel.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const HOOKS_DISPATCH_TIMEOUT_MS = 12_000; // ack do enqueue (deliver:false)
const POLL_TIMEOUT_MS = 35_000;           // espera total pela resposta do agente
const POLL_INTERVAL_MS = 1_500;
const HEARTBEAT_WINDOW_MS = 10 * 60 * 1000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

  let body: { message?: string };
  try {
    body = await req.json();
  } catch {
    return errorResponse("Body JSON inválido", 400);
  }
  const message = (body.message ?? "").trim();
  if (!message) return errorResponse("message obrigatória", 400);

  const admin = adminClient();

  // 1) Resolve a instance ONLINE do owner (heartbeat recente).
  const heartbeatCutoff = new Date(Date.now() - HEARTBEAT_WINDOW_MS).toISOString();
  const { data: instance } = await admin
    .from("instances")
    .select("id, ingress_url, hooks_token")
    .eq("owner_user_id", user.id)
    .eq("status", "online")
    .gt("last_heartbeat", heartbeatCutoff)
    .order("last_heartbeat", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!instance?.ingress_url || !instance?.hooks_token) {
    return jsonResponse({ error: "no_active_instance", message: "Nenhum OpenClaw online encontrado. Verifique se a instância está conectada." }, 409);
  }

  // 2) Pré-cria a row de resultado (status='pending'); a nina-reply preenche depois.
  const runId = `test-${crypto.randomUUID()}`;
  const testConversationId = crypto.randomUUID(); // cosmético; não cria conversa real
  const { error: insErr } = await admin.from("nina_test_results").insert({
    run_id: runId,
    owner_user_id: user.id,
    conversation_id: testConversationId,
    status: "pending",
  });
  if (insErr) {
    console.error("[nina-test] insert nina_test_results error:", insErr);
    return errorResponse("Erro ao iniciar teste", 500);
  }

  // 3) Dispara /hooks/agent (ack rápido via deliver:false). Sem instance/ack => erro.
  const agentMessage =
    `${message}\n\n` +
    `## Instrução de resposta\n` +
    `Responda à mensagem acima como a Nina. Para ENTREGAR sua resposta, execute a skill ` +
    `nina_reply.sh passando EXATAMENTE conversation_id=${testConversationId} e run_id=${runId} ` +
    `(também presentes no metadata desta chamada).`;

  const hookUrl = `${String(instance.ingress_url).replace(/\/+$/, "")}/hooks/agent`;
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), HOOKS_DISPATCH_TIMEOUT_MS);
  try {
    const hookResp = await fetch(hookUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${instance.hooks_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: agentMessage,
        name: "nina_whatsapp",
        wakeMode: "now",
        deliver: false,
        timeoutSeconds: 120,
        metadata: {
          conversation_id: testConversationId,
          run_id: runId,
          contact_id: null,
          mode: "test",
        },
      }),
      signal: controller.signal,
    });
    if (!hookResp.ok) {
      await admin.from("nina_test_results").update({ status: "error" }).eq("run_id", runId);
      return jsonResponse({ error: "dispatch_failed", status: hookResp.status, message: "Não foi possível alcançar seu OpenClaw." }, 502);
    }
  } catch (err) {
    const reason = (err as Error)?.name === "AbortError" ? "timeout" : ((err as Error)?.message ?? "erro de rede");
    await admin.from("nina_test_results").update({ status: "error" }).eq("run_id", runId);
    return jsonResponse({ error: "dispatch_failed", reason, message: "Não foi possível alcançar seu OpenClaw." }, 502);
  } finally {
    clearTimeout(timeoutId);
  }

  // 4) Poll pela resposta (chega via nina-reply -> nina_test_results), por run_id.
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);
    const { data: result } = await admin
      .from("nina_test_results")
      .select("content, status")
      .eq("run_id", runId)
      .maybeSingle();
    if (result && result.status !== "pending") {
      const latencyMs = Date.now() - startedAt;
      if (result.status === "error") {
        return jsonResponse({ error: "agent_error", latency_ms: latencyMs, message: "O agente retornou um erro." }, 200);
      }
      return jsonResponse({ content: result.content ?? "", latency_ms: latencyMs, status: result.status }, 200);
    }
  }

  // Timeout: a resposta não chegou a tempo.
  return jsonResponse({ error: "timeout", message: "O OpenClaw não respondeu a tempo. Tente novamente." }, 504);
});
