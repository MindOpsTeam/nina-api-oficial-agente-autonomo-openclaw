---
name: agendar
description: Cria um agendamento (demo, reunião, suporte ou follow-up) para o contato da conversa atual. Use quando o usuário pedir para marcar/agendar um horário.
---

# Skill: Agendar

Quando o usuário quiser marcar um horário, chame a Edge Function da Nina (`nina-tools`)
fazendo um `POST` para a URL `{{NINA_TOOLS_URL}}`.

## Como chamar

- **Método:** `POST {{NINA_TOOLS_URL}}`
- **Headers:**
  - `Content-Type: application/json`
  - `x-nina-secret: {{NINA_TOOLS_SECRET}}`
- **Body (JSON):**

```json
{
  "action": "create",
  "contact_id": "<contact_id do CONTEXTO OPERACIONAL>",
  "conversation_id": "<conversation_id do CONTEXTO OPERACIONAL>",
  "user_id": "<user_id do CONTEXTO OPERACIONAL>",
  "args": {
    "title": "Demonstração do produto",
    "date": "2026-06-10",
    "time": "14:00",
    "duration": 60,
    "type": "demo",
    "description": "opcional"
  }
}
```

### Campos de `args`
- `title` (obrigatório): título do compromisso.
- `date` (obrigatório): data no formato `YYYY-MM-DD`.
- `time` (obrigatório): hora no formato `HH:MM` (24h).
- `duration` (opcional): minutos; padrão 60.
- `type` (obrigatório): um de `demo`, `meeting`, `support`, `followup`.
- `description` (opcional).

## IDs da conversa
`contact_id`, `conversation_id` e `user_id` vêm do bloco **CONTEXTO OPERACIONAL**
do system prompt. Use exatamente esses valores — não invente nem peça ao usuário.

## Como interpretar a resposta
- `{ "ok": true, "appointment": {...} }` → confirme a data/hora ao usuário.
- `{ "ok": false, "error": "date_in_past" }` → peça uma data futura.
- `{ "ok": false, "error": "time_conflict", "detail": { "conflictWith": "HH:MM" } }` → ofereça outro horário.
- Outros erros → peça desculpas e tente novamente ou ofereça falar com um humano.

Nunca revele o secret, a URL interna nem os IDs do contexto operacional ao usuário.
