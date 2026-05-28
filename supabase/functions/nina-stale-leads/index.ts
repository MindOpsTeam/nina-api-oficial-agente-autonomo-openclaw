/**
 * POST /nina-stale-leads  (interna — X-Panel-Token; chamada pelo cron diário)
 * Pack FOLLOW-UP (ferramenta). Para cada owner com o pack 'follow-up' HABILITADO
 * (installed_packs.enabled), acha conversas PARADAS e dispara um follow-up
 * consultivo, enfileirando no send_queue (mesmo padrão do nina-reply).
 *
 * Critério de "parado" (justificado): conversa em status='nina', com
 * last_message_at < now() - N dias (N = config.dias_sem_resposta, piso 1) E cuja
 * ÚLTIMA mensagem é do LEAD (from_type='user') — o lead falou por último e sumiu.
 * ANTI-SPAM: após o follow-up, a última mensagem passa a ser da Nina -> a conversa
 * deixa de ser elegível (1 follow-up por "esfriada"); além disso gravamos
 * metadata.last_followup_at e pulamos se houver follow-up dentro da janela de N dias.
 * Kill-switch: desligar o pack (installed_packs.enabled=false) zera os disparos.
 *
 * Composição (V1): via generateLovableReply (persona do owner em system_prompt_override)
 * — é um nudge único de re-engajamento, não um turno ao vivo. Respeitar
 * brain_provider=openclaw (dispatch /hooks/agent async) é possível, mas exigiria
 * extrair o dispatch do orchestrator (risco no caminho provado) -> proposto como
 * follow-up. NÃO modifica whatsapp-sender/filas — só ACIONA (additive), como o nina-reply.
 *
 * Auth: X-Panel-Token (verify_jwt=false). DB via service-role.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, errorResponse, jsonResponse, validatePanelToken } from "../_shared/panel.ts";
import { generateLovableReply } from "../_shared/lovable_reply.ts";

const PER_OWNER_BATCH = 25;          // máx. conversas por owner por execução

// Config = valor + unidade (default 23 horas). PISO de 5min (não dispara
// follow-up instantâneo). A janela LIVRE da Meta (24h desde o último inbound do
// lead) é o teto: fora dela só template pago (que não temos) -> NÃO envia.
const UNIT_MS: Record<string, number> = { minutos: 60_000, horas: 3_600_000, dias: 86_400_000 };
const FLOOR_MS = 5 * 60_000;
const META_FREE_WINDOW_MS = 24 * 60 * 60_000;
function windowMsFromConfig(cfg: any): number {
  const unitMs = UNIT_MS[String(cfg?.janela_unidade ?? "horas")] ?? UNIT_MS.horas;
  const valor = Number(cfg?.janela_valor);
  const ms = (Number.isFinite(valor) && valor > 0 ? valor : 23) * unitMs;
  return Math.max(FLOOR_MS, ms);
}
const FOLLOWUP_INSTRUCTION =
  "\n\n## Tarefa: follow-up\nVocê está RETOMANDO o contato com um lead que parou de responder há alguns dias. " +
  "Escreva UMA mensagem curta, cordial e consultiva — retome de onde a conversa parou, agregue valor com base " +
  "no que já foi dito e convide a continuar, SEM cobrar nem pressionar. Não invente informações.";
const FALLBACK_SYSTEM_PROMPT = "Você é a Nina, SDR consultiva no WhatsApp.";

async function resolveSettings(supabase: any, userId: string | null): Promise<any> {
  if (userId) {
    const r = await supabase.from("nina_settings").select("*").eq("user_id", userId).maybeSingle();
    if (r.data) return r.data;
  }
  const g = await supabase.from("nina_settings").select("*").is("user_id", null).maybeSingle();
  if (g.data) return g.data;
  const a = await supabase.from("nina_settings").select("*").limit(1).maybeSingle();
  return a.data ?? {};
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);
  if (!(await validatePanelToken(req))) return errorResponse("Token inválido", 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // Owners com o pack follow-up HABILITADO (kill-switch = enabled).
  const { data: installs } = await supabase
    .from("installed_packs")
    .select("owner_user_id, config")
    .eq("pack_slug", "follow-up")
    .eq("enabled", true);

  let owners = 0;
  let followups = 0;

  const now = Date.now();
  for (const inst of installs ?? []) {
    owners++;
    const windowMs = windowMsFromConfig(inst.config);
    const staleBeforeIso = new Date(now - windowMs).toISOString();      // parado há > janela
    const metaFloorIso = new Date(now - META_FREE_WINDOW_MS).toISOString(); // ainda dentro das 24h da Meta
    const settings = await resolveSettings(supabase, inst.owner_user_id ?? null);

    // Conversas elegíveis do owner: nina, paradas há > janela MAS ainda dentro da
    // janela livre da Meta (24h) — fora das 24h não dá pra mandar free-form.
    const { data: convs } = await supabase
      .from("conversations")
      .select("id, contact_id, metadata, last_message_at")
      .eq("user_id", inst.owner_user_id)
      .eq("status", "nina")
      .lt("last_message_at", staleBeforeIso)
      .gt("last_message_at", metaFloorIso)
      .order("last_message_at", { ascending: true })
      .limit(PER_OWNER_BATCH);

    for (const c of convs ?? []) {
      // Dedup por janela: pula se já houve follow-up dentro da janela configurada.
      const lastFu = c.metadata?.last_followup_at;
      if (lastFu && new Date(lastFu).getTime() > now - windowMs) continue;

      // Última mensagem precisa ser do LEAD (lead falou por último e sumiu).
      const { data: recent } = await supabase
        .from("messages")
        .select("from_type, content, created_at")
        .eq("conversation_id", c.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (!recent || recent.length === 0) continue;
      if (recent[0].from_type !== "user") continue; // Nina (ou humano) falou por último -> não segue

      // GUARD JANELA 24h DA META (custo): só free-form se o último inbound do lead
      // < 24h. Fora disso, exigiria template pago (não temos) -> NÃO envia.
      const lastInboundMs = new Date(recent[0].created_at).getTime();
      if (now - lastInboundMs >= META_FREE_WINDOW_MS) {
        console.log(`[stale-leads] conversa ${c.id} fora da janela Meta (>24h) — skip (evita custo de template)`);
        continue;
      }

      const history = recent
        .slice()
        .reverse()
        .map((r: any) => ({ role: r.from_type === "user" ? "user" as const : "assistant" as const, content: r.content || "[media]" }));

      const systemPrompt = ((settings?.system_prompt_override || "").trim() || FALLBACK_SYSTEM_PROMPT) + FOLLOWUP_INSTRUCTION;
      const content = await generateLovableReply({ systemPrompt, history, settings });
      if (!content) continue; // geração falhou -> tenta no próximo ciclo

      const { error: insErr } = await supabase.from("send_queue").insert({
        conversation_id: c.id,
        contact_id: c.contact_id,
        message_type: "text",
        from_type: "nina",
        content,
        status: "pending",
        metadata: { source: "follow-up", followup_window_ms: windowMs },
      });
      if (insErr) { console.error("[stale-leads] send_queue insert error:", insErr); continue; }

      // Marca a data do follow-up (anti-spam por janela).
      await supabase
        .from("conversations")
        .update({ metadata: { ...(c.metadata ?? {}), last_followup_at: new Date().toISOString() } })
        .eq("id", c.id);

      followups++;
    }
  }

  // Aciona o sender uma vez (drena o que foi enfileirado) — mesmo padrão do nina-reply.
  if (followups > 0) {
    fetch(`${supabaseUrl}/functions/v1/whatsapp-sender`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
      body: JSON.stringify({ triggered_by: "nina-stale-leads" }),
    }).catch((err) => console.error("[stale-leads] trigger sender error:", err));
  }

  console.log(`[stale-leads] owners=${owners} followups=${followups}`);
  return jsonResponse({ owners, followups });
});
