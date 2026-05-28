// _shared/pack_templates.ts
// Conteúdo EMBUTIDO dos templates de Skill Packs (o brain-build roda no Supabase
// e não lê o filesystem do repo). MIRROR de skill-packs/<slug>/ no repo —
// mantenha os dois em sincronia (V1: manual; só packs de CONHECIMENTO aqui).
// path é relativo a skills/<slug>/ no commit do nina-brain.

export interface PackFile {
  path: string;      // relativo a skills/<slug>/
  content: string;
}

const TRATAMENTO_OBJECOES_SKILL = `---
name: tratamento-objecoes
description: "Pack de CONHECIMENTO para tratar objeções de vendas de forma consultiva (preço, tempo, confiança, concorrência, 'vou pensar'). Consulte ao perceber hesitação ou recusa do lead antes de oferecer o próximo passo."
allowed-tools: ["read"]
user-invocable: true
metadata:
  {
    "openclaw":
      {
        "emoji": "🛡️",
        "toolsProfile": "coding",
      },
  }
---

# Skill Pack: Tratamento de objeções

Pack de **conhecimento** (markdown puro, sem scripts). Quando o lead hesitar,
adiar ou recusar, consulte \`knowledge/objecoes.md\` e responda de forma
**consultiva** — acolha a objeção, reforce valor com base nas dores já levantadas
e proponha o próximo passo sem pressionar. Não invente preços/condições: use o que
estiver na identidade/conhecimento da empresa.
`;

const TRATAMENTO_OBJECOES_KNOWLEDGE = `# Tratamento de objeções (consultivo)

Princípio: **acolher → entender → reenquadrar com valor → propor próximo passo**.
Nunca discuta com o lead nem force. Use as dores que ele já mencionou. Não invente
preço, prazo ou condição — se não souber, ofereça confirmar com o time.

## "Está caro / não tenho orçamento agora"
- Acolha: "Entendo, faz sentido avaliar o investimento com cuidado."
- Reenquadre: conecte ao custo do problema atual (tempo perdido, oportunidades que escapam).
- Próximo passo: ofereça mostrar o retorno num diagnóstico rápido antes de falar de valores.

## "Preciso de tempo / vou pensar"
- Acolha: "Claro, decisão importante não se toma no susto."
- Entenda: "Só pra eu te ajudar melhor — o que ainda está em aberto pra você?"
- Próximo passo: proponha um horário para retomar com a dúvida específica resolvida.

## "Já uso outra solução / concorrente"
- Acolha: "Ótimo que já está cuidando disso."
- Reenquadre: pergunte o que funciona e o que falta na solução atual; foque na lacuna.
- Próximo passo: ofereça uma comparação objetiva no ponto que mais incomoda.

## "Não confio / não conheço vocês"
- Acolha: "Justo — confiança se constrói."
- Reforce: prova social, casos parecidos com o dele, garantias (use o que estiver no conhecimento da empresa).
- Próximo passo: ofereça uma conversa curta sem compromisso.

## "Não é prioridade agora"
- Acolha: "Entendo, prioridades mudam."
- Entenda: descubra qual é a prioridade atual e se o problema se conecta a ela.
- Próximo passo: combine um follow-up no momento certo (sem sumir).

## "Manda por escrito / me envia material"
- Atenda, mas mantenha o fio: envie algo curto e proponha um horário para tirar dúvidas.
- Evite virar "catálogo": o objetivo é a conversa consultiva, não o despejo de material.
`;

// Map slug -> arquivos do pack. Só packs de CONHECIMENTO no SP1; packs de
// ferramenta (follow-up/pesquisa-empresa) entram no SP3 com seus scripts.
export const PACK_TEMPLATES: Record<string, PackFile[]> = {
  "tratamento-objecoes": [
    { path: "SKILL.md", content: TRATAMENTO_OBJECOES_SKILL },
    { path: "knowledge/objecoes.md", content: TRATAMENTO_OBJECOES_KNOWLEDGE },
  ],
};

export function getPackFiles(slug: string): PackFile[] {
  return PACK_TEMPLATES[slug] ?? [];
}
