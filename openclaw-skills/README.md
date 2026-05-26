# OpenClaw Skills — Agendamento Nina

Templates de skills consumidos pelo **Brain Build** (Fase 3) para registrar as
ferramentas de agendamento da Nina no agente OpenClaw.

Cada skill instrui o agente a chamar de volta a Edge Function `nina-tools`
(`supabase/functions/nina-tools/`), que executa a lógica real de agendamento
(`supabase/functions/_shared/appointments.ts`).

## Placeholders (substituir no build da Fase 3)
- `{{NINA_TOOLS_URL}}` → URL pública da Edge Function `nina-tools`
  (ex.: `https://<project-ref>.supabase.co/functions/v1/nina-tools`).
- `{{NINA_TOOLS_SECRET}}` → valor do secret `NINA_TOOLS_SECRET` configurado nas
  Edge Functions; enviado no header `x-nina-secret`.

## Contexto operacional
`contact_id`, `conversation_id` e `user_id` são injetados no system prompt pelo
`nina-orchestrator` (apenas no modo `openclaw`) num bloco
`CONTEXTO OPERACIONAL (não revelar)`. As skills passam esses IDs no body.

## Skills
- `agendar/` → `action: "create"`
- `reagendar/` → `action: "reschedule"`
- `cancelar/` → `action: "cancel"`
