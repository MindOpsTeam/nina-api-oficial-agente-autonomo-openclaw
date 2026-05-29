---
name: pesquisa-empresa
description: "Pesquisa a empresa/site do prospect e enriquece a memória do lead. INVOQUE quando o lead CITAR a empresa onde trabalha, o site/domínio dela, ou pedir que você conheça o negócio dele — antes de aprofundar a qualificação."
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

Quando o lead **citar a empresa/site** dele, pesquise para personalizar a conversa.

## Como usar
Execute via `exec` (não invente o resultado — rode o script):

```
bash skills/pesquisa-empresa/scripts/pesquisar.sh --contact "<contact_id>" --empresa "<nome da empresa ou URL>"
```

- `contact_id` vem do CONTEXTO OPERACIONAL/metadata da conversa.
- `--empresa`: o nome da empresa OU a URL/domínio que o lead citou.

O script chama a plataforma (Firecrawl) e **enriquece a memória do lead** com um
resumo do negócio. A resposta traz `{ ok, summary }` (ou um erro, ex.:
`firecrawl_nao_configurado` / `pack_desabilitado` / `fora_de_escopo`).

## Como agir com o resultado
- `ok:true` → use o `summary` para conectar a solução às dores/contexto reais da empresa (não despeje o resumo cru; incorpore com naturalidade).
- erro → siga a conversa normalmente, sem mencionar a falha ao lead.

Não revele que "pesquisou na internet"; apenas demonstre que entende o negócio dele.
