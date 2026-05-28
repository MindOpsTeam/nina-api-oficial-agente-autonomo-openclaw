# Onboarding do Cliente — Sua Nina com cérebro OpenClaw

Este guia é o passo a passo que **você** (cliente/aluno) segue para subir a sua própria Nina: um agente de WhatsApp com o cérebro autônomo **OpenClaw** rodando na **sua** VPS.

> **Modelo single-tenant:** cada cliente tem **1 remix próprio** (seu repo no GitHub) + **1 OpenClaw na sua própria VPS**. Nada é compartilhado entre clientes.

**Pré-requisitos:**
- Conta no [Lovable](https://lovable.dev) (para remixar o projeto).
- Conta no GitHub (o remix gera um repo seu).
- Uma chave da Anthropic (`ANTHROPIC_API_KEY`).
- Uma VPS Linux com acesso `root` via SSH (ex.: Hostinger) — provisionada no Passo 4.

> ⚠️ **A ordem importa.** Faça os passos **na sequência**. As chaves e o sync do cérebro têm que existir **antes** de instalar na VPS — o passo *Instalar* só libera depois disso.

---

## Passo 1 — Remixar o projeto e criar sua conta

**O que fazer:**
1. Abra o template da Nina no Lovable e clique em **Remix**. Isso cria uma cópia sua do app e um **repositório próprio no seu GitHub** (você precisa conectar o GitHub no Lovable).
2. Com o app rodando, faça o **signup** (criar conta) dentro do próprio app da Nina. O primeiro usuário vira admin.

**Por quê:** o remix te dá um repo isolado — é nesse repo que o cérebro da Nina (a "skill") vai ser commitado no Passo 3. Sem repo próprio, não há onde versionar o conhecimento dela.

---

## Passo 2 — `/cerebro` → aba **CHAVES** (faça ANTES de instalar!)

Acesse a página **`/cerebro`** do seu app e vá na aba **Chaves**. Preencha as duas credenciais abaixo. **Este passo vem antes da instalação na VPS.**

### 2.1 — `ANTHROPIC_API_KEY` (obrigatória)
É a chave que faz o agente **pensar**. Sem ela, a Nina não responde.
- Cole a chave no campo da Anthropic.

### 2.2 — GitHub PAT (Personal Access Token)
É o token que permite o cérebro **commitar** no seu repo (Passo 3) e a VPS **puxar** o conhecimento.

**Requisito EXATO do token** — use **uma** das opções:
- **PAT clássico** com o escopo **`repo`**; **ou**
- **PAT fine-grained** com permissão **Contents: Read AND write** **no repo do seu remix**.

> 🛑 **Gotcha conhecido:** um PAT fine-grained **sem acesso ao repo do remix** causa **erro 404 no "Sincronizar cérebro"**. Se der 404, é quase sempre isso: o token não enxerga o repo. Confira o escopo/repo selecionado.

- Cole o token no campo **PAT do GitHub** (ele vai pro Vault e nunca é exibido de volta).
- Confira também o campo **Repositório do cérebro (GitHub)** — deve apontar para o repo do seu remix (`https://github.com/sua-org/seu-repo`).

### 2.3 — Testar conexão
Para **cada** chave, use o botão **"Testar conexão"**. Você recebe **✅ / ❌ na hora**. Só siga adiante com tudo ✅.

---

## Passo 3 — `/cerebro` → **TREINAR** o cérebro

Na aba **Treinar**, ensine a Nina:
- **Identidade** (quem ela é, tom de voz);
- **Produtos** (o que ela vende/atende);
- **Conhecimento** (FAQs, regras de negócio).

Atalho: dá pra **importar um template** pronto e ajustar.

**Quando terminar, clique em "Sincronizar cérebro".**

**Por quê:** o "Sincronizar" faz o *brain-build* commitar os arquivos da skill no branch dedicado **`nina-brain`** do seu repo. É desse branch que a VPS vai puxar o conhecimento (via cron, a cada ~2 min). Sem sincronizar, a VPS não tem o que rodar.

> Se aparecer **404** aqui → volte ao Passo 2.2 (PAT sem acesso ao repo).

---

## Passo 4 — `/cerebro` → **INSTALAR** na VPS

> ✅ Este passo **só libera depois** que as chaves estão ✅ e o cérebro foi sincronizado. Por isso a ordem importa.

**4.1 — Provisione a VPS:**
- Servidor Linux com acesso **`root` via SSH** (ex.: **Hostinger**).
- **Node 22.12+** (o instalador checa e instala o Node 22 LTS automaticamente se faltar — mas tenha um servidor limpo).

**4.2 — Rode o comando único:**
- Na aba **Instalar**, **gere e copie** o comando `curl`.
- Conecte na VPS via SSH como `root` e **cole o comando** (rode **uma única vez**).

**4.3 — Espere as confirmações.** O instalador deve terminar com:
- **`✓ Anthropic configurado`**
- **`✓ Instância registrada`**

Ao final ele também registra os crons na VPS: **heartbeat a cada 5 min** (re-detecta a URL e reenvia o system_prompt) e **brain-sync a cada 2 min** (puxa o branch `nina-brain`).

> 💡 **Você não precisa reinstalar para trocar chaves.** Trocar a chave da Anthropic ou o GitHub PAT **se propaga sozinho** para a VPS via heartbeat (~5 min). Só reinstale se mudar a **URL** ou as **credenciais do servidor**.

---

## Passo 5 — `/cerebro` → **ATIVAR**

Na aba **Ativar**, ligue o toggle **"Usar OpenClaw como cérebro"**. Isso muda o `brain_provider` de `lovable` para `openclaw`.

> ⚠️ **Ative só com a instância ONLINE.** Conecte a VPS e **aguarde o heartbeat** aparecer (status online no `/cerebro`) antes de ligar o toggle. Se a instância estiver offline, o toggle fica bloqueado.

---

## Passo 6 — Conectar o WhatsApp

A Nina usa a camada **WhatsApp Cloud API (Meta)** que já existe no app.

Na aba **APIs** das configurações, preencha:
- **Phone Number ID** (`phone_number_id`);
- **Access Token** (`access_token`).

Configure também o **webhook** do WhatsApp Cloud API apontando para a URL da sua instância. A partir daí a Nina começa a receber e responder mensagens.

---

## Passo 7 — Produção (opcional, mas recomendado)

Para uso real (não só trial), faça os dois ajustes abaixo.

### 7.1 — URL estável com Named Cloudflare Tunnel
Por padrão a VPS sobe um **quick tunnel** (`*.trycloudflare.com`) — a URL **muda a cada restart**. Para produção, configure um **Named Cloudflare Tunnel** (URL fixa, HTTPS na borda, sem abrir portas na VPS).

➡️ **Passo a passo completo:** veja [`install/docs/named-tunnel.md`](../install/docs/named-tunnel.md).
Resumo: crie o tunnel no Cloudflare Zero Trust, aponte o Public Hostname para `localhost:18789`, e entregue `CF_TUNNEL_TOKEN` + `CF_TUNNEL_HOSTNAME` ao painel. Com os dois presentes, a VPS entra em modo named e registra a URL fixa.

### 7.2 — Cron do reaper de órfãos
Para limpar dados/chunks órfãos automaticamente, provisione o **cron do reaper**. Ele precisa da **service-role key** do seu projeto (passo de provisionamento). Configure-a como segredo no ambiente da função antes de agendar o cron.

---

## Troubleshooting (gotchas reais)

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| **404 ao "Sincronizar cérebro"** | PAT fine-grained **sem acesso ao repo** do remix (ou sem `Contents: write`). | Regenere o PAT com `repo` (clássico) **ou** `Contents: Read and write` no repo certo. Reteste no Passo 2.2. |
| **"Anthropic ausente"** na VPS | Instalou **sem** a chave da Anthropic salva/✅. | Re-rode o comando de install **OU** aguarde o **self-heal do heartbeat (~5 min)** — a chave se propaga sozinha depois de salva no painel. |
| **Re-instalar na mesma VPS** | Mudou URL/credenciais do servidor. | Pode rodar o `curl` de novo — o re-install na mesma VPS é **limpo** (idempotente). |
| **OpenClaw parece "travado" numa versão** | Ele fica **pinado em `2026.5.26`** de propósito. | **Não atualize à toa.** A versão é fixada para estabilidade — só mude com orientação. |
| **Nina não responde no WhatsApp** | Instância offline, ou WhatsApp/cérebro não ativados. | No `/cerebro`, **cheque se a instância está ONLINE**. Confirme Passo 5 (Ativar) e Passo 6 (WhatsApp/webhook). |

---

## Checklist rápido

- [ ] Passo 1 — Remix feito + conta criada no app
- [ ] Passo 2 — `ANTHROPIC_API_KEY` ✅ e GitHub PAT ✅ (com escopo certo)
- [ ] Passo 3 — Cérebro treinado + **Sincronizar** sem 404
- [ ] Passo 4 — Install na VPS: `✓ Anthropic configurado` + `✓ Instância registrada`
- [ ] Passo 5 — Toggle OpenClaw ligado (instância ONLINE)
- [ ] Passo 6 — WhatsApp conectado (Phone Number ID + Access Token + webhook)
- [ ] Passo 7 — (Prod) Named Tunnel + cron do reaper
