// _shared/lovable_reply.ts
// Geração de resposta via Lovable AI, reutilizável fora do orchestrator.
// Usado pelo reaper (reap-orphan-runs) pra recuperar turnos órfãos do openclaw
// SEM re-despachar pro openclaw (evita re-orfanizar). Reaproveita LOVABLE_AI_URL
// + getBrainConfig do _shared/brain.ts. Gera texto (sem tool-calling): é uma rede
// de segurança — a persona do cliente vem do systemPrompt (system_prompt_override).

import { getBrainConfig, LOVABLE_AI_URL } from "./brain.ts";

const LOVABLE_TIMEOUT_MS = 30_000;

export interface LovableReplyInput {
  systemPrompt: string;
  history: { role: "user" | "assistant"; content: string }[];
  settings: any;          // nina_settings (p/ getBrainConfig: model/apiKey)
  lovableApiKey?: string;  // default: env LOVABLE_API_KEY (via getBrainConfig)
}

// Gera uma resposta de texto via Lovable AI. Retorna a string ou null em falha.
export async function generateLovableReply(input: LovableReplyInput): Promise<string | null> {
  const cfg = getBrainConfig(
    { ...input.settings, brain_provider: "lovable" },
    { lovableApiKey: input.lovableApiKey },
  );

  const requestBody = {
    model: cfg.model,
    messages: [
      { role: "system", content: input.systemPrompt },
      ...input.history,
    ],
    temperature: 0.7,
    max_tokens: 1000,
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), LOVABLE_TIMEOUT_MS);
  try {
    const resp = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: { "Authorization": `Bearer ${cfg.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
    if (!resp.ok) {
      console.error("[lovable_reply] HTTP", resp.status, (await resp.text()).slice(0, 200));
      return null;
    }
    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content ?? "";
    return content.trim() || null;
  } catch (e) {
    console.error("[lovable_reply] erro:", (e as Error)?.message ?? e);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
