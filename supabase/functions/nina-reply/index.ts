/**
 * POST /nina-reply
 * Callback assíncrono do agente OpenClaw: recebe a resposta de um run e a
 * enfileira em send_queue, reaproveitando o fluxo do whatsapp-sender.
 * NÃO mexe no whatsapp-sender nem no schema das filas — só INSERE em send_queue.
 *
 * F5b: runs de TESTE (run_id com prefixo 'test-') NÃO vão pro send_queue — são
 * gravados na tabela dedicada nina_test_results (lida pela edge fn nina-test).
 * Garante que a resposta de teste jamais seja enviada a um WhatsApp real.
 * O caminho de PRODUÇÃO (run_id sem 'test-') segue 100% inalterado.
 *
 * Auth: X-Panel-Token.
 * Body: { conversation_id, run_id, content, status }  (status = 'sent' | 'error')
 * Retorna: { queued: true, send_queue_id } | { test: true } | 204.
 */
import {
  adminClient,
  corsHeaders,
  errorResponse,
  jsonResponse,
  validatePanelToken,
} from "../_shared/panel.ts";

// EdgeRuntime é global no runtime de Edge Functions do Supabase (pode não existir
// em outros runtimes — por isso checamos antes de usar).
declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);
  if (!(await validatePanelToken(req))) return errorResponse("Token inválido", 401);

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

  // ── F5b: run de TESTE — grava no canal dedicado, NUNCA no send_queue ────────
  // A row já foi pré-criada (status='pending') pela edge fn nina-test; aqui só
  // preenchemos content/status. Retorna cedo — não toca send_queue de jeito nenhum.
  if (runId && runId.startsWith("test-")) {
    const admin = adminClient();
    const { error: updErr } = await admin
      .from("nina_test_results")
      .update({ content, status: agentStatus, updated_at: new Date().toISOString() })
      .eq("run_id", runId);
    if (updErr) {
      console.error("[nina-reply] nina_test_results update error:", updErr);
      return errorResponse("Erro ao registrar resultado de teste", 500);
    }
    console.log(`[nina-reply] resultado de teste registrado (run_id=${runId}, status=${agentStatus})`);
    return jsonResponse({ test: true, run_id: runId });
  }
  // ────────────────────────────────────────────────────────────────────────────

  if (!conversationId) return errorResponse("conversation_id obrigatório", 400);

  const supabase = adminClient();

  // send_queue exige contact_id (NOT NULL) — resolve a partir da conversa.
  // Traz também a client_memory do contato (p/ o analyze-conversation mesclar — GAP6).
  const { data: conversation, error: convErr } = await supabase
    .from("conversations")
    .select("id, contact_id, contact:contacts(client_memory)")
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

  // DEDUP: se já existe resposta da Nina nesta conversa criada DEPOIS da última
  // msg do lead, PULA o insert. Cobre: (a) fallback Lovable respondeu + VPS
  // respondeu depois; (b) reaper recuperou + VPS depois. Não bloqueia o 1º turno
  // legítimo (aí ainda não há resposta da Nina após a última msg do lead).
  const { data: lastLead } = await supabase
    .from("messages")
    .select("created_at")
    .eq("conversation_id", conversation.id)
    .eq("from_type", "user")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastLead?.created_at) {
    const since = lastLead.created_at;
    const dupSq = await supabase
      .from("send_queue").select("id")
      .eq("conversation_id", conversation.id).eq("from_type", "nina")
      .gt("created_at", since).limit(1).maybeSingle();
    let alreadyReplied = !!dupSq.data;
    if (!alreadyReplied) {
      const dupMsg = await supabase
        .from("messages").select("id")
        .eq("conversation_id", conversation.id).eq("from_type", "nina")
        .gt("created_at", since).limit(1).maybeSingle();
      alreadyReplied = !!dupMsg.data;
    }
    if (alreadyReplied) {
      console.log(`[nina-reply] dedup: resposta já existe nesta conversa (run_id=${runId}) — pulando insert`);
      return jsonResponse({ deduped: true, run_id: runId ?? null });
    }
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

  // Aciona o whatsapp-sender pra DRENAR a fila — mesmo padrão do nina-orchestrator
  // (mesma função alvo + header service-role). No caminho OpenClaw assíncrono
  // ninguém mais aciona o envio; sem isto a resposta fica 'pending' pra sempre.
  // EdgeRuntime.waitUntil mantém o disparo vivo após a resposta, sem bloqueá-la.
  // NÃO altera o whatsapp-sender nem o schema da fila — só ACIONA o sender existente.
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const triggerSender = fetch(`${supabaseUrl}/functions/v1/whatsapp-sender`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
    body: JSON.stringify({ triggered_by: "nina-reply" }),
  }).catch((err) => console.error("[nina-reply] Error triggering whatsapp-sender:", err));

  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
    EdgeRuntime.waitUntil(triggerSender);
  }

  // GAP6: dispara analyze-conversation pra atualizar a client_memory do lead também
  // no caminho openclaw. O orchestrator só dispara no caminho lovable; o ramo
  // openclaw faz o dispatch async e retorna antes -> a memória nunca atualizava.
  // Espelha o trigger do orchestrator (mesmo alvo + header service-role + body).
  // 1x por reply, só no caminho real (o de teste já retornou cedo). NÃO altera o
  // analyze-conversation nem o caminho lovable.
  const currentMemory = (conversation as any).contact?.client_memory ?? {};
  const triggerAnalyze = (async () => {
    // user_message = última mensagem do lead nesta conversa (pode faltar -> '').
    let userMessage = "";
    try {
      const { data: lastUserMsg } = await supabase
        .from("messages")
        .select("content")
        .eq("conversation_id", conversation.id)
        .eq("from_type", "user")
        .order("sent_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      userMessage = lastUserMsg?.content ?? "";
    } catch (_e) {
      // segue com user_message vazio
    }
    await fetch(`${supabaseUrl}/functions/v1/analyze-conversation`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
      body: JSON.stringify({
        contact_id: conversation.contact_id,
        conversation_id: conversation.id,
        user_message: userMessage,
        ai_response: content,
        current_memory: currentMemory,
      }),
    });
  })().catch((err) => console.error("[nina-reply] Error triggering analyze-conversation:", err));

  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
    EdgeRuntime.waitUntil(triggerAnalyze);
  }

  return jsonResponse({ queued: true, send_queue_id: queued.id });
});
