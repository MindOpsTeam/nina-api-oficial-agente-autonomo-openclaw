/**
 * POST /nina-enrich  (interna — x-nina-secret; chamada pelo script pesquisar.sh)
 * Pack PESQUISA-EMPRESA: pesquisa a empresa/site do lead (Firecrawl), resume e
 * enriquece contacts.client_memory (append/merge, NÃO sobrescreve).
 *
 * Auth: header x-nina-secret vs NINA_TOOLS_SECRET (Vault) — MESMO padrão do nina-tools.
 * Body: { contact_id, query }  (query = nome da empresa OU URL/domínio)
 * Retorna: { ok:true, summary, domain } | { ok:false, error }.
 *
 * Guards:
 *  - FIRECRAWL_API_KEY do Vault (get_secret); ausente -> {ok:false, error:'firecrawl_nao_configurado'}.
 *  - KILL-SWITCH: só roda se o pack 'pesquisa-empresa' estiver ENABLED pro owner.
 *  - DEDUP/custo: 1 enrich por DOMÍNIO por lead (client_memory.enriched_domains).
 *  - SSRF: valida/normaliza a URL antes de crawlear — bloqueia host interno/IP
 *    privado/loopback/link-local/metadata/esquema não-http(s).
 * NÃO modifica whatsapp-sender/filas. DB via service-role.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/panel.ts";
import { getSecret } from "../_shared/secrets.ts";
import { generateLovableReply } from "../_shared/lovable_reply.ts";

const FIRECRAWL_API = "https://api.firecrawl.dev/v1";
const SCRAPE_MAX_CHARS = 12_000;

// SSRF guard: aceita só http(s) p/ host público (sem IP privado/loopback/etc).
function publicHttpUrl(raw: string): { url: string; domain: string } | null {
  let u: URL;
  try { u = new URL(raw); } catch { return null; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || host === "0.0.0.0" || host.endsWith(".local") || host.endsWith(".internal")) return null;
  if (host.includes(":")) {
    // IPv6 literal: bloqueia loopback/ULA/link-local E IPv4-mapped (::ffff:*, que
    // cobre ::ffff:127.0.0.1 / 169.254.169.254 / 10.x etc); público é permitido.
    // startsWith('::') é seguro aqui pois só IPv6 entra neste branch (host tem ':').
    // (Gatear em ':' evita over-block de domínios fc*/fd* — ex.: fcbarcelona.com.)
    if (host.startsWith("::") || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80")) return null;
    return { url: u.toString(), domain: host };
  }
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) { // IPv4 literal
    const p = host.split(".").map(Number);
    if (p[0] === 0 || p[0] === 10 || p[0] === 127) return null;
    if (p[0] === 169 && p[1] === 254) return null;            // link-local / metadata
    if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return null; // privado
    if (p[0] === 192 && p[1] === 168) return null;            // privado
    if (p[0] === 100 && p[1] >= 64 && p[1] <= 127) return null; // CGNAT
  }
  if (!host.includes(".")) return null; // domínio/IPv4 exige "." (não se aplica a IPv6, tratado acima)
  return { url: u.toString(), domain: host.replace(/^www\./, "") };
}

// Normaliza a query do lead -> URL pública (se já for URL/domínio) ou null (nome).
function queryToUrl(query: string): { url: string; domain: string } | null {
  const q = query.trim();
  if (/^https?:\/\//i.test(q)) return publicHttpUrl(q);
  if (/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i.test(q) && !/\s/.test(q)) return publicHttpUrl(`https://${q}`);
  return null; // é um NOME de empresa -> usa search
}

async function fcPost(path: string, key: string, body: unknown): Promise<any | null> {
  try {
    const r = await fetch(`${FIRECRAWL_API}${path}`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) { console.error(`[nina-enrich] firecrawl ${path} HTTP ${r.status}`); return null; }
    return await r.json();
  } catch (e) { console.error(`[nina-enrich] firecrawl ${path} erro:`, (e as Error)?.message); return null; }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  // Auth x-nina-secret (mesmo padrão do nina-tools).
  const expected = await getSecret("NINA_TOOLS_SECRET");
  const provided = req.headers.get("x-nina-secret");
  if (!expected || !provided || provided !== expected) return jsonResponse({ ok: false, error: "unauthorized" }, 401);

  let body: { contact_id?: string; query?: string };
  try { body = await req.json(); } catch { return errorResponse("Body JSON inválido", 400); }
  const contactId = body.contact_id;
  const query = (body.query ?? "").trim();
  if (!contactId) return jsonResponse({ ok: false, error: "missing_contact_id" }, 400);
  if (!query) return jsonResponse({ ok: false, error: "missing_query" }, 400);

  const firecrawlKey = await getSecret("FIRECRAWL_API_KEY");
  if (!firecrawlKey) return jsonResponse({ ok: false, error: "firecrawl_nao_configurado" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // KILL-SWITCH: pack habilitado pro owner (resolve owner via conversa do contato;
  // single-tenant -> fallback p/ qualquer install habilitado).
  const { data: conv } = await supabase
    .from("conversations").select("user_id").eq("contact_id", contactId)
    .order("last_message_at", { ascending: false }).limit(1).maybeSingle();
  let enabled = false;
  if (conv?.user_id) {
    const r = await supabase.from("installed_packs").select("enabled")
      .eq("owner_user_id", conv.user_id).eq("pack_slug", "pesquisa-empresa").maybeSingle();
    enabled = !!r.data?.enabled;
  }
  if (!enabled) {
    const any = await supabase.from("installed_packs").select("id")
      .eq("pack_slug", "pesquisa-empresa").eq("enabled", true).limit(1).maybeSingle();
    enabled = !!any.data;
  }
  if (!enabled) return jsonResponse({ ok: false, error: "pack_desabilitado" });

  // Carrega o contato (client_memory p/ dedup + merge).
  const { data: contact } = await supabase
    .from("contacts").select("client_memory, name").eq("id", contactId).maybeSingle();
  if (!contact) return jsonResponse({ ok: false, error: "contato_nao_encontrado" }, 404);
  const cm: any = contact.client_memory ?? {};
  const enrichedDomains: string[] = Array.isArray(cm.enriched_domains) ? cm.enriched_domains : [];

  // Resolve a URL alvo: direta (URL/domínio) ou via search (nome). Valida SSRF.
  let target = queryToUrl(query);
  if (!target) {
    const search = await fcPost("/search", firecrawlKey, { query, limit: 5 });
    const results: any[] = search?.data ?? search?.results ?? [];
    for (const r of results) {
      const cand = publicHttpUrl(String(r?.url ?? ""));
      if (cand) { target = cand; break; }
    }
  }
  if (!target) return jsonResponse({ ok: false, error: "fora_de_escopo" }); // nada público/válido

  // DEDUP por domínio (custo): já enriquecido p/ este lead -> no-op.
  if (enrichedDomains.includes(target.domain)) {
    return jsonResponse({ ok: true, skipped: "ja_enriquecido", domain: target.domain });
  }

  // Scrape (Firecrawl).
  const scrape = await fcPost("/scrape", firecrawlKey, { url: target.url, formats: ["markdown"], onlyMainContent: true });
  const markdown: string = (scrape?.data?.markdown ?? scrape?.markdown ?? "").toString();
  if (!markdown.trim()) return jsonResponse({ ok: false, error: "scrape_vazio", domain: target.domain });

  // Resume via o cérebro (lovable_reply) — factual, p/ um SDR.
  const summary = await generateLovableReply({
    systemPrompt:
      "Você é um analista de pré-vendas. Resuma o site da empresa abaixo em 4–8 bullets ÚTEIS pra um SDR: " +
      "o que a empresa faz, produtos/serviços, porte/segmento e possíveis dores/oportunidades. Seja factual, " +
      "NÃO invente. Responda só os bullets, em pt-BR.",
    history: [{ role: "user", content: markdown.slice(0, SCRAPE_MAX_CHARS) }],
    settings: {},
  });
  if (!summary) return jsonResponse({ ok: false, error: "resumo_falhou", domain: target.domain });

  // MERGE em client_memory (append; não sobrescreve o resto).
  const newCm = {
    ...cm,
    company_research: { domain: target.domain, source_url: target.url, summary, enriched_at: new Date().toISOString() },
    enriched_domains: Array.from(new Set([...enrichedDomains, target.domain])),
  };
  const { error: updErr } = await supabase.from("contacts").update({ client_memory: newCm }).eq("id", contactId);
  if (updErr) { console.error("[nina-enrich] update client_memory error:", updErr); return jsonResponse({ ok: false, error: "persist_falhou" }, 500); }

  console.log(`[nina-enrich] contato ${contactId} enriquecido (${target.domain})`);
  return jsonResponse({ ok: true, domain: target.domain, summary });
});
