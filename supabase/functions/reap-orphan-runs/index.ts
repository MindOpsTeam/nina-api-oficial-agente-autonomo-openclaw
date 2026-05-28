/**
 * POST /reap-orphan-runs  (interna — service-role; chamada pelo pg_cron a cada ~2min)
 * REAPER de runs órfãos do caminho openclaw: o orchestrator marca
 * processed_by_nina=true ao receber o ACK 2xx do /hooks/agent. Se a VPS morrer
 * DEPOIS do ACK e nunca chamar o nina-reply, o lead fica SEM resposta. Este job
 * acha esses turnos órfãos e garante uma resposta via FALLBACK Lovable (enfileira
 * no send_queue) — NÃO re-despacha pro openclaw (evitaria re-orfanizar).
 *
 * Órfão = mensagem inbound (from_type='user') com processed_by_nina=true, criada
 * há > 5min (e < 30min — janela de segurança), SEM resposta da Nina (from_type
 * 'nina' em messages OU send_queue) criada DEPOIS dela, e ainda não tratada
 * (messages.metadata.reaped_at ausente). Idempotente: marca reaped_at só após
 * enfileirar com sucesso.
 *
 * Auth: X-Panel-Token (vs PANEL_TOKEN do Vault) — mesmo padrão das outras fns de
 * painel. O cron (public.trigger_reaper) lê o PANEL_TOKEN do Vault em runtime e
 * envia no header. As operações INTERNAS de DB seguem com SUPABASE_SERVICE_ROLE_KEY.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, errorResponse, validatePanelToken } from "../_shared/panel.ts";
import { generateLovableReply } from "../_shared/lovable_reply.ts";

const ORPHAN_MIN_AGE_MS = 5 * 60 * 1000;   // tem que ter > 5min (margem: latência openclaw observada ~30-100s; evita preemptar resposta boa com fallback)
const ORPHAN_MAX_AGE_MS = 30 * 60 * 1000;  // janela: não reapar > 30min
const BATCH = 50;

const FALLBACK_SYSTEM_PROMPT =
  "Você é a Nina, SDR consultiva no WhatsApp. Responda à última mensagem do lead " +
  "de forma curta, cordial e consultiva, dando continuidade à conversa.";

// Resolve nina_settings com o fallback triplo do orchestrator (single-tenant).
async function resolveSettings(supabase: any, userId: string | null): Promise<any> {
  const cols = "*";
  if (userId) {
    const r = await supabase.from("nina_settings").select(cols).eq("user_id", userId).maybeSingle();
    if (r.data) return r.data;
  }
  const g = await supabase.from("nina_settings").select(cols).is("user_id", null).maybeSingle();
  if (g.data) return g.data;
  const a = await supabase.from("nina_settings").select(cols).limit(1).maybeSingle();
  return a.data ?? {};
}

async function hasNinaReplyAfter(supabase: any, conversationId: string, afterIso: string): Promise<boolean> {
  const sq = await supabase
    .from("send_queue")
    .select("id")
    .eq("conversation_id", conversationId)
    .eq("from_type", "nina")
    .gt("created_at", afterIso)
    .limit(1)
    .maybeSingle();
  if (sq.data) return true;
  const msg = await supabase
    .from("messages")
    .select("id")
    .eq("conversation_id", conversationId)
    .eq("from_type", "nina")
    .gt("created_at", afterIso)
    .limit(1)
    .maybeSingle();
  return !!msg.data;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!(await validatePanelToken(req))) return errorResponse("Token inválido", 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const now = Date.now();
  const olderThanIso = new Date(now - ORPHAN_MIN_AGE_MS).toISOString();
  const withinIso = new Date(now - ORPHAN_MAX_AGE_MS).toISOString();

  // Candidatos: inbound processados há 3–30min.
  const { data: candidates, error: candErr } = await supabase
    .from("messages")
    .select("id, conversation_id, content, metadata, created_at")
    .eq("from_type", "user")
    .eq("processed_by_nina", true)
    .lte("created_at", olderThanIso)
    .gte("created_at", withinIso)
    .order("created_at", { ascending: true })
    .limit(BATCH);

  if (candErr) {
    console.error("[reaper] candidates query error:", candErr);
    return new Response(JSON.stringify({ error: "query_failed" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let scanned = 0;
  let reaped = 0;

  for (const m of candidates ?? []) {
    scanned++;
    if (m.metadata?.reaped_at) continue;                       // já tratado
    if (await hasNinaReplyAfter(supabase, m.conversation_id, m.created_at)) continue; // tem resposta -> não órfão

    // Órfão confirmado. Resolve conversa/owner + histórico.
    const { data: conversation } = await supabase
      .from("conversations")
      .select("id, contact_id, user_id, status")
      .eq("id", m.conversation_id)
      .maybeSingle();
    if (!conversation || !conversation.contact_id) continue;
    if (conversation.status && conversation.status !== "nina") continue; // saiu do modo Nina

    const settings = await resolveSettings(supabase, conversation.user_id ?? null);

    const { data: recent } = await supabase
      .from("messages")
      .select("from_type, content")
      .eq("conversation_id", m.conversation_id)
      .order("created_at", { ascending: false })
      .limit(20);
    const history = (recent ?? [])
      .reverse()
      .map((r: any) => ({ role: r.from_type === "user" ? "user" as const : "assistant" as const, content: r.content || "[media]" }));

    const systemPrompt = (settings?.system_prompt_override || "").trim() || FALLBACK_SYSTEM_PROMPT;
    const content = await generateLovableReply({ systemPrompt, history, settings });
    if (!content) {
      console.warn(`[reaper] geração falhou p/ msg ${m.id} — deixa pro próximo ciclo (dentro da janela)`);
      continue; // NÃO marca reaped_at -> tenta de novo no próximo cron
    }

    const { error: insErr } = await supabase.from("send_queue").insert({
      conversation_id: conversation.id,
      contact_id: conversation.contact_id,
      message_type: "text",
      from_type: "nina",
      content,
      status: "pending",
      metadata: { source: "reaper", reaped_for_message: m.id },
    });
    if (insErr) {
      console.error("[reaper] send_queue insert error:", insErr);
      continue; // não marca -> retry
    }

    // Marca o inbound como tratado (idempotência).
    await supabase
      .from("messages")
      .update({ metadata: { ...(m.metadata ?? {}), reaped_at: new Date().toISOString() } })
      .eq("id", m.id);

    // Aciona o sender pra entregar (mesmo padrão do nina-reply/orchestrator).
    fetch(`${supabaseUrl}/functions/v1/whatsapp-sender`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
      body: JSON.stringify({ triggered_by: "reap-orphan-runs" }),
    }).catch((err) => console.error("[reaper] trigger sender error:", err));

    reaped++;
    console.log(`[reaper] órfão recuperado: msg=${m.id} conversa=${conversation.id}`);
  }

  return new Response(JSON.stringify({ scanned, reaped }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
