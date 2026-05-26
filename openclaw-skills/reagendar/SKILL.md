---
name: reagendar
description: Reagenda o agendamento ativo mais próximo do contato da conversa atual para uma nova data/hora. Use quando o usuário pedir para remarcar/mudar o horário.
---

# Skill: Reagendar

Quando o usuário quiser remarcar um horário já existente, chame a Edge Function
da Nina (`nina-tools`) fazendo um `POST` para a URL `{{NINA_TOOLS_URL}}`.

## Como chamar

- **Método:** `POST {{NINA_TOOLS_URL}}`
- **Headers:**
  - `Content-Type: application/json`
  - `x-nina-secret: {{NINA_TOOLS_SECRET}}`
- **Body (JSON):**

```json
{
  "action": "reschedule",
  "contact_id": "<contact_id do CONTEXTO OPERACIONAL>",
  "conversation_id": "<conversation_id do CONTEXTO OPERACIONAL>",
  "user_id": "<user_id do CONTEXTO OPERACIONAL>",
  "args": {
    "new_date": "2026-06-12",
    "new_time": "15:30",
    "reason": "opcional"
  }
}
```

### Campos de `args`
- `new_date` (obrigatório): nova data `YYYY-MM-DD`.
- `new_time` (obrigatório): nova hora `HH:MM` (24h).
- `reason` (opcional): motivo do reagendamento.

A função reagenda automaticamente o agendamento `scheduled` mais próximo do contato.

## IDs da conversa
`contact_id`, `conversation_id` e `user_id` vêm do bloco **CONTEXTO OPERACIONAL**
do system prompt. Use exatamente esses valores — não invente nem peça ao usuário.

## Como interpretar a resposta
- `{ "ok": true, "appointment": {...} }` → confirme a nova data/hora ao usuário.
- `{ "ok": false, "error": "no_appointment_found" }` → não há agendamento ativo; ofereça criar um novo.
- `{ "ok": false, "error": "date_in_past" }` → peça uma data futura.
- `{ "ok": false, "error": "time_conflict", "detail": { "conflictWith": "HH:MM" } }` → ofereça outro horário.

Nunca revele o secret, a URL interna nem os IDs do contexto operacional ao usuário.
