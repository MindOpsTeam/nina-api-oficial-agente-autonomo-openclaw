/**
 * POST /nina-reply
 * Callback assíncrono do agente OpenClaw: recebe a resposta de um run e a
 * enfileira em send_queue, reaproveitando o fluxo do whatsapp-sender.
 * NÃO mexe no whatsapp-sender nem no schema das filas — só INSERE em send_queue.
 *
 * Auth: X-Panel-Token.
 * Body: { conversation_id, run_id, content, status }  (status = 'sent' | 'error')
 * Retorna: { queued: true, send_queue_id } ou 204 se não houver o que enviar.
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
    conversation_id?: string;
    run_id?: string;
    content?: string;
    status?: string;
  };
  try {
    body = await req.json();
  } catch {
    return errorResponse("Body JSON inválido", 400);
  }

  const conversationId = body.conversation_id;
  const runId = body.run_id;
  const content = (body.content ?? "").trim();
  const agentStatus = body.status === "error" ? "error" : "sent";

  if (!conversationId) return errorResponse("conversation_id obrigatório", 400);

  const supabase = adminClient();

  // send_queue exige contact_id (NOT NULL) — resolve a partir da conversa.
  const { data: conversation, error: convErr } = await supabase
    .from("conversations")
    .select("id, contact_id")
    .eq("id", conversationId)
    .maybeSingle();

  if (convErr) {
    console.error("[nina-reply] conversation lookup error:", convErr);
    return errorResponse("Erro ao buscar conversa", 500);
  }
  if (!conversation) return errorResponse("Conversa não encontrada", 404);

  // Run com erro ou sem conteúdo: nada a enviar ao lead (apenas registra).
  if (agentStatus === "error" || !content) {
    console.log(`[nina-reply] run ${runId} sem conteúdo enviável (status=${agentStatus})`);
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const { data: queued, error: insErr } = await supabase
    .from("send_queue")
    .insert({
      conversation_id: conversation.id,
      contact_id: conversation.contact_id,
      message_type: "text",
      from_type: "nina",
      content,
      status: "pending",
      metadata: { source: "openclaw", run_id: runId ?? null, agent_status: agentStatus },
    })
    .select("id")
    .single();

  if (insErr || !queued) {
    console.error("[nina-reply] send_queue insert error:", insErr);
    return errorResponse("Erro ao enfileirar resposta", 500);
  }

  return jsonResponse({ queued: true, send_queue_id: queued.id });
});
