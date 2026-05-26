# SPIKE-OPENCLAW — Fase 0 (Viabilidade, bloqueante)

**Objetivo:** derriscar 3 incógnitas antes de trocar o cérebro da Nina (hoje uma
chamada ao Lovable AI em `supabase/functions/nina-orchestrator/index.ts:751`) por
um agente **OpenClaw self-hosted**.

- **Data do spike:** 2026-05-26
- **Executor:** agente Integrador
- **Versão OpenClaw testada:** `2026.5.22 (a374c3a)` (npm `openclaw@latest`)
- **Branch:** `spike/openclaw-viabilidade`

---

## TL;DR — Decisão

| # | Item | Resultado |
|---|------|-----------|
| 0 | Docker disponível no ambiente do executor | ❌ **FAIL** (mitigado) |
| 1 | **TOOL-NO-TURNO** (crítico) | ✅ **PASS** |
| 2 | Mecânica de workspace (SOUL/AGENTS/skills, reload) | ✅ **PASS** |
| 3 | Provider/model do LLM sem créditos nexos.ai | ✅ **PASS** |

**Veredito: VIÁVEL.** O endpoint `POST /v1/chat/completions` do gateway OpenClaw
executa o **agent run completo no mesmo turno** (skill dispara → HTTP de callback
sai → texto final volta no body), e é **OpenAI-compatible** — drop-in para o
formato que a Nina já usa hoje. Pode seguir para F2/F3.

---

## 0. Gate Docker — FAIL (mitigado, não bloqueou)

A ordem exigia subir o OpenClaw **via Docker**. O ambiente do executor **NÃO tem
nenhum runtime de container**:

```
docker: command not found
podman/colima/lima/nerdctl/finch: ausentes
/Applications/Docker.app: inexistente
/var/run/docker.sock: inexistente
brew: presente | sudo: exige senha (não-interativo indisponível)
```

**Mitigação aplicada (não teórica):** o OpenClaw é distribuído como **pacote npm
com binário CLI** (`openclaw`, "Multi-channel AI gateway", deps: express/openai/ws).
Com Node v24 disponível, subi o gateway **nativo via npm** — mesmo binário que a
imagem Docker empacota. Todos os testes abaixo rodaram contra esse gateway real.

> ⚠️ **Para Deivid / produção:** na Hostinger o deploy será via Docker
> (`github.com/openclaw/openclaw`). A imagem roda o mesmo CLI; a config
> (`openclaw.json`) e o workspace são idênticos. O que **não** dá para validar
> localmente e **depende do Deivid** está na seção "Pendências Hostinger".

---

## 1. [CRÍTICO] TOOL-NO-TURNO — ✅ PASS

**Pergunta:** ao receber "quero agendar amanhã às 14h", (a) a skill `agendar` roda
no **mesmo turno**? (b) o HTTP de callback **realmente sai e chega** no mock? (c) a
resposta final **volta no body** do `/v1/chat/completions`?

### Resposta dos docs oficiais (confirmada empiricamente)

> "Under the hood, requests are executed as a normal Gateway agent run (same
> codepath as `openclaw agent`), so routing/permissions/config match your Gateway."
> — `docs/gateway/openai-http-api.md`

E o **contrato do campo `model` é agent-first**, não um model id de provider:
`model: "openclaw"` → agente default; `model: "openclaw/<agentId>"` → agente
específico. O LLM backend é escolhido pela config (`agents.defaults.model`) ou pelo
header `x-openclaw-model`.

### Setup do teste (tudo local, sem créditos pagos)

```
Nina (curl)  ──POST /v1/chat/completions──►  OpenClaw gateway :18789  (REAL)
                                                  │  agent run (skill 'agendar')
                                                  ├─► provider LLM  :18800  (mock OpenAI-compat*)
                                                  └─► exec bash → curl → backend :18900 (mock callback)
```

\* Como não havia LLM key no ambiente do executor, o **cérebro** foi um mock
OpenAI-compatible que força, de forma determinística, o `tool_call` de `exec`.
**Todo o resto é OpenClaw real**: carregamento de skill, despacho de tool, loop de
function-calling e montagem da resposta. Isso isola e prova a *mecânica* do OpenClaw
(que é o risco do spike); a decisão do LLM é trivialmente substituível por um
provider real (ver item 3).

### Chamada (request real)

```bash
curl -s http://127.0.0.1:18789/v1/chat/completions \
  -H "Authorization: Bearer spike-token-123" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openclaw",
    "messages": [{"role":"user","content":"Oi Nina, quero agendar uma consulta amanhã às 14h, pode ser?"}],
    "user": "spike-thread-001"
  }'
# → [HTTP 200] em 46.8s
```

### (a) Skill rodou no MESMO turno? ✅ SIM

Uma única chamada ao gateway disparou o loop canônico de function-calling
(3 round-trips ao provider, **todos dentro da mesma request**):

- **Turno 1:** `GET /v1/models` (probe do provider).
- **Turno 2:** `POST /chat/completions` — OpenClaw envia system prompt + a mensagem
  do usuário e **expõe 29 tools nativas**, incluindo `exec`:
  `agents_list, browser, canvas, cron, dir_fetch, dir_list, edit, exec, file_fetch,
  file_write, gateway, memory_get, memory_search, message, nodes, process, read,
  session_status, sessions_history, sessions_list, sessions_send, sessions_spawn,
  sessions_yield, subagents, tts, web_fetch, web_search, write`.
- **Turno 3:** a conversa já inclui o `tool_call` do assistant **e o resultado da
  tool** — prova de que o OpenClaw executou a tool e re-alimentou o modelo no mesmo turno:

```json
{
  "assistant_tool_call": [{
    "id": "callreqrzs8u0",
    "type": "function",
    "function": {
      "name": "exec",
      "arguments": "{\"command\":\"bash .../workspace/skills/agendar/scripts/agendar.sh \\\"2026-05-27\\\" \\\"14:00\\\"\"}"
    }
  }],
  "tool_result": {
    "role": "tool",
    "tool_call_id": "callreqrzs8u0",
    "content": "{\"ok\":true,\"appointment_id\":\"appt_xtiazsh3\",\"status\":\"confirmed\"}"
  }
}
```

### (b) HTTP de callback saiu e chegou no mock? ✅ SIM

Log real do backend mock (`mock-callback.received.jsonl`) — POST disparado pela
skill via `curl` dentro do turno:

```json
{
  "method": "POST",
  "url": "/agendamento",
  "headers": { "user-agent": "curl/8.7.1", "content-type": "application/json" },
  "body": {"acao":"create_appointment","data":"2026-05-27","hora":"14:00","origem":"openclaw-skill-agendar"}
}
```

O backend respondeu `{"ok":true,"appointment_id":"appt_xtiazsh3","status":"confirmed"}`.

### (c) Resposta final voltou no body do /v1/chat/completions? ✅ SIM

```json
{
  "id": "chatcmpl_e574fd9b-e7b8-40a9-a1a2-882de227d6c3",
  "object": "chat.completion",
  "model": "openclaw",
  "choices": [{
    "index": 0,
    "finish_reason": "stop",
    "message": {
      "role": "assistant",
      "content": "Perfeito! Sua consulta está agendada para amanhã (27/05) às 14:00. ✅ (backend: {\"ok\":true,\"appointment_id\":\"appt_xtiazsh3\",\"status\":\"confirmed\"})"
    }
  }],
  "usage": {"prompt_tokens":20,"completion_tokens":20,"total_tokens":40}
}
```

> Note que o `appointment_id` gerado pelo backend **voltou no texto final** — ou
> seja, o resultado real do callback ficou disponível ao agente no mesmo turno.

### Plano B (não foi necessário, mas testado)

A ordem pedia testar `POST /api/tools/invoke` e a session API como fallback se o
turno não funcionasse. Como o Plano A passou, registro apenas a sondagem:

- `POST /api/tools/invoke` → **HTTP 404** neste build (2026.5.22). O endpoint
  aparece no site de docs, mas **não está exposto** nesta versão. Irrelevante: não
  é necessário.
- **Endpoint correto e suficiente: `POST /v1/chat/completions`** (`model:"openclaw"`).

---

## 2. Mecânica de workspace — ✅ PASS

### Como o OpenClaw carrega SOUL.md / AGENTS.md / skills

- **Bootstrap files (SOUL.md, AGENTS.md, etc.)** são injetados **direto no system
  prompt** a cada agent run. Confirmado: o system prompt enviado ao provider tinha
  15.794 chars e continha o conteúdo do SOUL.md ("Nina"...).
- **Skills** são injetadas como catálogo `<available_skills>` (nome + descrição +
  *location*); o corpo do `SKILL.md` é carregado **on-demand** (progressive
  disclosure) — o agente lê o arquivo via tool quando a skill é disparada. Trecho
  real do system prompt:

```xml
<available_skills>
  <skill>
    <name>agendar</name>
    <description>Agendar, remarcar ou cancelar consulta: faz POST HTTP no backend de agendamento com data e hora.</description>
    <location>.../spike-openclaw/workspace/skills/agendar/SKILL.md</location>
  </skill>
</available_skills>
```

- `openclaw skills list` confirma: **`agendar` = `✓ ready`, Source
  `openclaw-workspace`**. `openclaw skills check`: "Visible to model: 1
  (agendar)". O allowlist `agents.defaults.skills: ["agendar"]` **excluiu** as 22
  skills bundled, deixando só a nossa visível ao modelo.

### Restart vs. hot reload — ✅ HOT RELOAD

Teste empírico: editei `SOUL.md` adicionando um marcador único
(`HOTRELOAD-MARKER-7788`) **sem reiniciar o gateway** e refiz o POST. O marcador
**apareceu no system prompt** do novo turno → **bootstrap files são relidos por
agent-run (hot, sem restart)**.

- Para o **catálogo de skills**, use `skills.load.watch: true` (file-watching com
  `watchDebounceMs`).
- Para **edições de config (`openclaw.json`)**, há `gateway.reload.mode`:
  `off | restart | hot | hybrid` (usei `hot`).

### `openclaw.json` mínimo (validado: `openclaw config validate` → "Config valid")

```json
{
  "$schema": "https://docs.openclaw.ai/openclaw.schema.json",
  "gateway": {
    "mode": "local",
    "port": 18789,
    "bind": "loopback",
    "auth": { "mode": "token", "token": "spike-token-123" },
    "http": { "endpoints": { "chatCompletions": { "enabled": true } } },
    "reload": { "mode": "hot" }
  },
  "models": {
    "mode": "merge",
    "providers": {
      "mock": {
        "baseUrl": "http://127.0.0.1:18800/v1",
        "apiKey": "sk-mock-spike",
        "api": "openai-completions",
        "models": [
          { "id": "mock-1", "name": "Mock LLM (spike)", "contextWindow": 32000, "maxTokens": 1024 }
        ]
      }
    }
  },
  "agents": {
    "defaults": {
      "model": { "primary": "mock/mock-1" },
      "workspace": ".../spike-openclaw/workspace",
      "skills": ["agendar"]
    }
  },
  "skills": { "load": { "watch": true } },
  "tools": { "exec": { "host": "gateway", "security": "full", "ask": "off" } }
}
```

**Campos-chave (exatos, do JSON Schema do binário):**

| Campo | Função |
|-------|--------|
| `gateway.port` | porta do listener (default 18789) |
| `gateway.bind` | `auto\|lan\|loopback\|custom\|tailnet` |
| `gateway.auth.mode` / `.token` | `none\|token\|password\|trusted-proxy`; Bearer no header |
| `gateway.http.endpoints.chatCompletions.enabled` | **liga o `/v1/chat/completions`** (default **false**) |
| `gateway.reload.mode` | reload de config: `off\|restart\|hot\|hybrid` |
| `agents.defaults.model` | string `"provider/model"` ou `{ primary, fallbacks[] }` |
| `agents.defaults.workspace` | path do workspace (SOUL/AGENTS/skills) |
| `agents.defaults.skills` | allowlist de skills visíveis ao agente |
| `skills.load.watch` | hot-watch do catálogo de skills |
| `tools.exec` | `{ host, security: deny\|allowlist\|full, ask: off\|on-miss\|always }` |

> ⚠️ O `/v1/chat/completions` é tratado como **superfície de operador full-access**.
> O token do gateway = credencial de operador. Mantê-lo só em loopback/tailnet/ingress
> privado — **nunca exposto direto na internet** (ver Pendências Hostinger).

### Formato de um `SKILL.md` que faz HTTP externo

Frontmatter YAML (`name` + `description` obrigatórios; opcionais `allowed-tools`,
`user-invocable`, `metadata`, `homepage`, `license`) + corpo markdown que instrui o
agente a rodar um script determinístico via a tool `exec`. O HTTP sai do script
(curl), não de código embutido no prompt:

```markdown
---
name: agendar
description: "Agendar, remarcar ou cancelar consulta: faz POST HTTP no backend de agendamento com data e hora."
allowed-tools: ["exec"]
user-invocable: true
---

# Skill: agendar
Dispare quando o cliente quiser agendar/remarcar/cancelar.

## Workflow
1. Extraia `data` e `hora` da mensagem.
2. Execute: `bash skills/agendar/scripts/agendar.sh "<data>" "<hora>"`
   (o script imprime o JSON do backend, com `appointment_id`).
3. Confirme ao cliente em linguagem natural (✅) só após `"ok": true`.
```

`scripts/agendar.sh` (o HTTP externo de fato):

```bash
#!/usr/bin/env bash
set -euo pipefail
DATA="${1:-amanha}"; HORA="${2:-14:00}"
CALLBACK="${AGENDAR_CALLBACK_URL:-http://127.0.0.1:18900/agendamento}"
PAYLOAD=$(printf '{"acao":"create_appointment","data":"%s","hora":"%s","origem":"openclaw-skill-agendar"}' "$DATA" "$HORA")
curl -sS -X POST "$CALLBACK" -H 'Content-Type: application/json' -d "$PAYLOAD"
```

---

## 3. Provider/model do LLM sem créditos nexos.ai — ✅ PASS

O OpenClaw **não está preso ao gateway nexos.ai**. O provider é configurável em
`models.providers.<id>` com `baseUrl` + `apiKey` + `api` (adaptador) + `models[]`,
e o agente aponta para ele via `agents.defaults.model = "provider/modelId"`.

**Adaptadores `api` suportados** (do schema):
`openai-completions | openai-responses | openai-codex-responses |
anthropic-messages | google-generative-ai | github-copilot |
bedrock-converse-stream | ollama | azure-openai-responses`.

No spike usei `api: "openai-completions"` apontando para um servidor local — e o
OpenClaw fez exatamente o que faria com a OpenAI real (`GET /v1/models`,
`POST /v1/chat/completions` com `tools[]`). **A fiação de provider está provada**;
só o modelo pago foi substituído.

### Opções para F2/F3 (escolher uma)

| Cenário | Config | Custo |
|---------|--------|-------|
| **OpenAI** (key própria) | `api:"openai-responses"`, `baseUrl:"https://api.openai.com/v1"`, `apiKey` via env-ref | pago por uso |
| **Anthropic** (key própria) | `api:"anthropic-messages"`, `baseUrl:"https://api.anthropic.com"` | pago por uso |
| **Ollama local** (zero custo) | `api:"ollama"`, `baseUrl:"http://127.0.0.1:11434"`, ou `provider.localService` p/ o OpenClaw subir o servidor | grátis (self-host) |
| **Qualquer OpenAI-compat** (OpenRouter, LiteLLM, vLLM) | `api:"openai-completions"`, `baseUrl` do gateway | varia |

**Boas práticas (alinhadas ao role do Integrador):**
- API key **nunca** hardcoded/no frontend → usar env-ref:
  `openclaw config set models.providers.openai.apiKey --ref-source env --ref-id OPENAI_API_KEY`
  e prover a key ao processo do gateway (ex.: `~/.openclaw/.env`).
- `agents.defaults.model = { primary: "openai/gpt-...", fallbacks: ["anthropic/claude-..."] }`
  dá fallback automático entre providers.

> ⚠️ **Pendência para o Deivid:** não havia LLM key (OpenAI/Anthropic) no ambiente
> do executor. Para um re-run **end-to-end com cérebro real** (LLM decidindo
> disparar a skill por conta própria), preciso de **1 key de teste** OU autorização
> para `brew install ollama` + baixar um modelo pequeno local.

---

## Pendências que dependem do Deivid (Hostinger)

| Item | O que precisa | Dá p/ testar local? |
|------|---------------|---------------------|
| Deploy via Docker | Conta Hostinger + Docker no host | Não (validado nativo via npm — mesma engine) |
| Injeção de workspace remoto | Acesso ao filesystem/volume do container na Hostinger | Não |
| **TLS público** | Domínio + cert (ou `gateway.tls.autoGenerate` / Tailscale Funnel) | Parcial (config conhecida; cert real depende do host) |
| LLM key de teste | 1 key OpenAI/Anthropic **ou** OK p/ Ollama local | Não (bloqueado por ausência de key) |

> 🔒 Lembrete de segurança: o `/v1/chat/completions` é full operator-access. Em
> produção, **bind privado + reverse proxy/Tailscale**, nunca porta pública nua.

---

## Decisão de implementação para F2/F3

1. **Arquitetura:** a Nina (`nina-orchestrator`) passa a chamar
   `POST https://<openclaw-host>/v1/chat/completions` com `model:"openclaw"` e
   `Authorization: Bearer <gateway-token>`, em vez do `ai.gateway.lovable.dev`.
   Como ambos são OpenAI-compatible, **muda só a URL, o token e o `model`**.
2. **Inversão de responsabilidade (ganho real):** hoje o orchestrator parseia
   `tool_calls` e cria o appointment no Supabase (`index.ts:~785`). Com OpenClaw, a
   **skill `agendar` faz o callback HTTP** (para uma Edge Function dedicada, ex.
   `POST /functions/v1/nina-agendar`) **dentro do turno**, e a Nina só repassa o
   `choices[0].message.content` ao WhatsApp. Menos código de orquestração na Nina.
3. **Workspace da Nina:** `SOUL.md` (persona), `AGENTS.md` (regras) e
   `skills/{agendar,remarcar,cancelar}/` com scripts que chamam Edge Functions
   idempotentes (retry + validação) — exatamente o padrão do role Integrador.
4. **Provider:** definir em F2 (recomendado: Anthropic/OpenAI com key própria +
   fallback; ou Ollama p/ custo zero em staging).
5. **Próximo derisk (F2):** re-run com **LLM real** decidindo a skill sozinho
   (depende da key — ver pendências) e medir latência (o turno completo levou ~47s
   com mock local; com provider real medir p50/p95).

---

## Como reproduzir (artefatos no diretório de spike do executor)

```
spike-openclaw/
  openclaw.json                      # config validada
  workspace/SOUL.md                  # persona da Nina
  workspace/AGENTS.md                # regras
  workspace/skills/agendar/SKILL.md  # skill + scripts/agendar.sh
  mock-llm.mjs                       # provider OpenAI-compat (cérebro determinístico)
  mock-callback.mjs                  # backend de agendamento mock (:18900)
  mock-llm.requests.jsonl            # JSONs reais dos 3 turnos
  mock-callback.received.jsonl       # JSON real do callback HTTP
  chatcompletions.response.json      # resposta final real
```

```bash
npm i openclaw@latest
OPENCLAW_CONFIG_PATH=$PWD/openclaw.json OPENCLAW_STATE_DIR=$PWD/state \
  npx openclaw gateway run --force --allow-unconfigured
# noutro shell: subir mock-callback.mjs + mock-llm.mjs e fazer o POST do item 1
```
