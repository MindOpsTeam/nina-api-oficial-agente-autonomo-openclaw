---
name: pesquisa-empresa
description: "Pesquisa a empresa/site do prospect e enriquece a memória do lead. INVOQUE SEMPRE que o lead mencionar a empresa onde trabalha, um site/domínio, ou pedir que você conheça o negócio dele — antes de aprofundar a qualificação."
allowed-tools: ["exec", "read"]
user-invocable: true
metadata:
  {
    "openclaw":
      {
        "emoji": "🔎",
        "requires": { "bins": ["bash", "curl"], "tools": ["exec"] },
        "toolsProfile": "coding",
      },
  }
---

# Skill Pack: Pesquisa de empresa

**SEMPRE que o lead mencionar a empresa onde trabalha OU um site/domínio, você DEVE
imediatamente pesquisar** — não é opcional e não peça permissão. Faça de forma
natural no fluxo da conversa.

## Regra (imperativa)
Ao detectar uma empresa/site na fala do lead:
1. **Extraia** o site/URL ou o nome da empresa do que ele disse.
2. **Chame a skill JÁ**, via `exec` (nunca invente o resultado — rode o script):

```
bash skills/pesquisa-empresa/scripts/pesquisar.sh --contact "<contact_id>" --empresa "<nome da empresa ou URL>"
```

- `contact_id` vem do CONTEXTO OPERACIONAL/metadata da conversa.
- `--empresa`: passe a **URL/domínio** se o lead citou; senão passe o **NOME** da empresa.

## Só tem o nome (sem URL)?
**Chame mesmo assim com o nome** — o backend faz `search → site oficial → scrape`.
A prioridade é **TENTAR pesquisar já com o que você tem**. Só se ainda assim não
der pra identificar a empresa, pergunte de forma leve ("qual o site de vocês?")
para capturar — mas tente primeiro, sempre.

## Uma vez por empresa
Pesquise **uma vez por empresa** — o backend já deduplica por domínio (chamar de
novo pro mesmo domínio é no-op). Use o resultado para **personalizar** a conversa.

## Como agir com o resultado
- `ok:true` → use o `summary` para conectar a solução às dores/contexto reais da empresa (não despeje o resumo cru; incorpore com naturalidade).
- erro (`firecrawl_nao_configurado` / `pack_desabilitado` / `fora_de_escopo`) → siga a conversa normalmente, sem mencionar a falha ao lead.

Não revele que "pesquisou na internet"; apenas demonstre que entende o negócio dele.
