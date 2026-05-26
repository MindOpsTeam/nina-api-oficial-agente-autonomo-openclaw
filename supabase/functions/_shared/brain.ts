// Brain Provider (Fase 1)
// Centraliza a escolha de "onde a Nina pensa": Lovable AI (padrão) ou OpenClaw.
// Ambos os provedores expõem o MESMO contrato OpenAI-compatible:
//   POST {url}  (com sufixo /v1/chat/completions) + header Authorization: Bearer {apiKey}
//   body { model, messages, temperature, max_tokens, tools?, tool_choice? }
// Mantido propositalmente flexível: o caminho primário é /v1/chat/completions; o
// spike do Integrador pode refinar detalhes sem alterar este contrato.

// Endpoint do Lovable AI Gateway (comportamento atual — não alterar).
export const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

export type BrainProvider = "lovable" | "openclaw";

export interface BrainConfig {
  provider: BrainProvider;
  url: string;
  apiKey: string;
  model: string;
}

export interface GetBrainConfigOptions {
  // Modelo escolhido dinamicamente para o Lovable (via getModelSettings no orchestrator).
  lovableModel?: string;
  // API key do Lovable; default = env LOVABLE_API_KEY (mantém comportamento atual).
  lovableApiKey?: string;
}

// Normaliza a URL do OpenClaw para o endpoint OpenAI-compatible.
// Aceita base ("https://host") ou já com o path; evita path duplicado.
function normalizeOpenClawUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (/\/v1\/chat\/completions$/.test(trimmed)) return trimmed;
  if (/\/v1$/.test(trimmed)) return `${trimmed}/chat/completions`;
  return `${trimmed}/v1/chat/completions`;
}

// Indica se o provedor OpenClaw está minimamente configurado (url + token).
export function isOpenClawConfigured(settings: any): boolean {
  return Boolean(settings?.openclaw_gateway_url?.trim() && settings?.openclaw_gateway_token?.trim());
}

/**
 * Resolve a configuração do "cérebro" da Nina a partir de nina_settings.
 *
 * - provider 'openclaw': usa openclaw_gateway_url + openclaw_gateway_token + openclaw_model.
 * - provider 'lovable' (padrão): usa LOVABLE_AI_URL + LOVABLE_API_KEY + modelo dinâmico
 *   (lovableModel, vindo de getModelSettings) — comportamento idêntico ao atual.
 *
 * Se 'openclaw' estiver selecionado mas mal configurado, cai para 'lovable' (o
 * orchestrator ainda tem o fallback de runtime para falhas de rede/timeout/5xx).
 */
export function getBrainConfig(settings: any, opts: GetBrainConfigOptions = {}): BrainConfig {
  const provider: BrainProvider = settings?.brain_provider === "openclaw" ? "openclaw" : "lovable";

  if (provider === "openclaw" && isOpenClawConfigured(settings)) {
    return {
      provider: "openclaw",
      url: normalizeOpenClawUrl(settings.openclaw_gateway_url),
      apiKey: String(settings.openclaw_gateway_token).trim(),
      model: (settings.openclaw_model?.trim() || "openclaw"),
    };
  }

  // Padrão / fallback de configuração: Lovable AI.
  return {
    provider: "lovable",
    url: LOVABLE_AI_URL,
    apiKey: opts.lovableApiKey ?? Deno.env.get("LOVABLE_API_KEY") ?? "",
    model: opts.lovableModel ?? "google/gemini-2.5-flash",
  };
}
