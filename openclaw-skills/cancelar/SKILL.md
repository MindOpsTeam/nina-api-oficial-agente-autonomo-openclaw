---
name: cancelar
description: Cancela o agendamento ativo mais próximo do contato da conversa atual. Use quando o usuário pedir para cancelar/desmarcar o horário.
---

# Skill: Cancelar

Quando o usuário quiser cancelar um horário, chame a Edge Function da Nina
(`nina-tools`) fazendo um `POST` para a URL `{{NINA_TOOLS_URL}}`.

## Como chamar

- **Método:** `POST {{NINA_TOOLS_URL}}`
- **Headers:**
  - `Content-Type: application/json`
  - `x-nina-secret: {{NINA_TOOLS_SECRET}}`
- **Body (JSON):**

```json
{
  "action": "cancel",
  "contact_id": "<contact_id do CONTEXTO OPERACIONAL>",
  "conversation_id": "<conversation_id do CONTEXTO OPERACIONAL>",
  "user_id": "<user_id do CONTEXTO OPERACIONAL>",
  "args": {
    "reason": "opcional"
  }
}
```

### Campos de `args`
- `reason` (opcional): motivo do cancelamento.

A função cancela automaticamente o agendamento `scheduled` mais próximo do contato.

## IDs da conversa
`contact_id`, `conversation_id` e `user_id` vêm do bloco **CONTEXTO OPERACIONAL**
do system prompt. Use exatamente esses valores — não invente nem peça ao usuário.

## Como interpretar a resposta
- `{ "ok": true, "appointment": {...} }` → confirme o cancelamento ao usuário.
- `{ "ok": false, "error": "no_appointment_found" }` → não há agendamento ativo para cancelar.

Nunca revele o secret, a URL interna nem os IDs do contexto operacional ao usuário.
