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

// SP3b: pesquisa-empresa (pack de FERRAMENTA, com script). Conteúdo embutido em
// base64 (o bash tem ${...} e \n que quebrariam um template literal) e decodificado
// UTF-8-safe. MIRROR FIEL de skill-packs/pesquisa-empresa/.
function b64utf8(b64: string): string {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
const PESQUISA_EMPRESA_SKILL_B64 =
  "LS0tCm5hbWU6IHBlc3F1aXNhLWVtcHJlc2EKZGVzY3JpcHRpb246ICJQZXNxdWlzYSBhIGVtcHJlc2Evc2l0ZSBkbyBwcm9zcGVjdCBlIGVucmlxdWVjZSBhIG1lbcOzcmlhIGRvIGxlYWQuIElOVk9RVUUgU0VNUFJFIHF1ZSBvIGxlYWQgbWVuY2lvbmFyIGEgZW1wcmVzYSBvbmRlIHRyYWJhbGhhLCB1bSBzaXRlL2RvbcOtbmlvLCBvdSBwZWRpciBxdWUgdm9jw6ogY29uaGXDp2EgbyBuZWfDs2NpbyBkZWxlIOKAlCBhbnRlcyBkZSBhcHJvZnVuZGFyIGEgcXVhbGlmaWNhw6fDo28uIgphbGxvd2VkLXRvb2xzOiBbImV4ZWMiLCAicmVhZCJdCnVzZXItaW52b2NhYmxlOiB0cnVlCm1ldGFkYXRhOgogIHsKICAgICJvcGVuY2xhdyI6CiAgICAgIHsKICAgICAgICAiZW1vamkiOiAi8J+UjiIsCiAgICAgICAgInJlcXVpcmVzIjogeyAiYmlucyI6IFsiYmFzaCIsICJjdXJsIl0sICJ0b29scyI6IFsiZXhlYyJdIH0sCiAgICAgICAgInRvb2xzUHJvZmlsZSI6ICJjb2RpbmciLAogICAgICB9LAogIH0KLS0tCgojIFNraWxsIFBhY2s6IFBlc3F1aXNhIGRlIGVtcHJlc2EKCioqU0VNUFJFIHF1ZSBvIGxlYWQgbWVuY2lvbmFyIGEgZW1wcmVzYSBvbmRlIHRyYWJhbGhhIE9VIHVtIHNpdGUvZG9tw61uaW8sIHZvY8OqIERFVkUKaW1lZGlhdGFtZW50ZSBwZXNxdWlzYXIqKiDigJQgbsOjbyDDqSBvcGNpb25hbCBlIG7Do28gcGXDp2EgcGVybWlzc8Ojby4gRmHDp2EgZGUgZm9ybWEKbmF0dXJhbCBubyBmbHV4byBkYSBjb252ZXJzYS4KCiMjIFJlZ3JhIChpbXBlcmF0aXZhKQpBbyBkZXRlY3RhciB1bWEgZW1wcmVzYS9zaXRlIG5hIGZhbGEgZG8gbGVhZDoKMS4gKipFeHRyYWlhKiogbyBzaXRlL1VSTCBvdSBvIG5vbWUgZGEgZW1wcmVzYSBkbyBxdWUgZWxlIGRpc3NlLgoyLiAqKkNoYW1lIGEgc2tpbGwgSsOBKiosIHZpYSBgZXhlY2AgKG51bmNhIGludmVudGUgbyByZXN1bHRhZG8g4oCUIHJvZGUgbyBzY3JpcHQpOgoKYGBgCmJhc2ggc2tpbGxzL3Blc3F1aXNhLWVtcHJlc2Evc2NyaXB0cy9wZXNxdWlzYXIuc2ggLS1jb250YWN0ICI8Y29udGFjdF9pZD4iIC0tZW1wcmVzYSAiPG5vbWUgZGEgZW1wcmVzYSBvdSBVUkw+IgpgYGAKCi0gYGNvbnRhY3RfaWRgIHZlbSBkbyBDT05URVhUTyBPUEVSQUNJT05BTC9tZXRhZGF0YSBkYSBjb252ZXJzYS4KLSBgLS1lbXByZXNhYDogcGFzc2UgYSAqKlVSTC9kb23DrW5pbyoqIHNlIG8gbGVhZCBjaXRvdTsgc2Vuw6NvIHBhc3NlIG8gKipOT01FKiogZGEgZW1wcmVzYS4KCiMjIFPDsyB0ZW0gbyBub21lIChzZW0gVVJMKT8KKipDaGFtZSBtZXNtbyBhc3NpbSBjb20gbyBub21lKiog4oCUIG8gYmFja2VuZCBmYXogYHNlYXJjaCDihpIgc2l0ZSBvZmljaWFsIOKGkiBzY3JhcGVgLgpBIHByaW9yaWRhZGUgw6kgKipURU5UQVIgcGVzcXVpc2FyIGrDoSBjb20gbyBxdWUgdm9jw6ogdGVtKiouIFPDsyBzZSBhaW5kYSBhc3NpbSBuw6NvCmRlciBwcmEgaWRlbnRpZmljYXIgYSBlbXByZXNhLCBwZXJndW50ZSBkZSBmb3JtYSBsZXZlICgicXVhbCBvIHNpdGUgZGUgdm9jw6pzPyIpCnBhcmEgY2FwdHVyYXIg4oCUIG1hcyB0ZW50ZSBwcmltZWlybywgc2VtcHJlLgoKIyMgVW1hIHZleiBwb3IgZW1wcmVzYQpQZXNxdWlzZSAqKnVtYSB2ZXogcG9yIGVtcHJlc2EqKiDigJQgbyBiYWNrZW5kIGrDoSBkZWR1cGxpY2EgcG9yIGRvbcOtbmlvIChjaGFtYXIgZGUKbm92byBwcm8gbWVzbW8gZG9tw61uaW8gw6kgbm8tb3ApLiBVc2UgbyByZXN1bHRhZG8gcGFyYSAqKnBlcnNvbmFsaXphcioqIGEgY29udmVyc2EuCgojIyBDb21vIGFnaXIgY29tIG8gcmVzdWx0YWRvCi0gYG9rOnRydWVgIOKGkiB1c2UgbyBgc3VtbWFyeWAgcGFyYSBjb25lY3RhciBhIHNvbHXDp8OjbyDDoHMgZG9yZXMvY29udGV4dG8gcmVhaXMgZGEgZW1wcmVzYSAobsOjbyBkZXNwZWplIG8gcmVzdW1vIGNydTsgaW5jb3Jwb3JlIGNvbSBuYXR1cmFsaWRhZGUpLgotIGVycm8gKGBmaXJlY3Jhd2xfbmFvX2NvbmZpZ3VyYWRvYCAvIGBwYWNrX2Rlc2FiaWxpdGFkb2AgLyBgZm9yYV9kZV9lc2NvcG9gKSDihpIgc2lnYSBhIGNvbnZlcnNhIG5vcm1hbG1lbnRlLCBzZW0gbWVuY2lvbmFyIGEgZmFsaGEgYW8gbGVhZC4KCk7Do28gcmV2ZWxlIHF1ZSAicGVzcXVpc291IG5hIGludGVybmV0IjsgYXBlbmFzIGRlbW9uc3RyZSBxdWUgZW50ZW5kZSBvIG5lZ8OzY2lvIGRlbGUuCg==";
const PESQUISA_EMPRESA_SCRIPT_B64 =
  "IyEvdXNyL2Jpbi9lbnYgYmFzaAojIHBlc3F1aXNhci5zaCDigJQgcGVzcXVpc2EgYSBlbXByZXNhL3NpdGUgZG8gbGVhZCB2aWEgZWRnZSBmbiBuaW5hLWVucmljaCAoRmlyZWNyYXdsKQojIGUgZW5yaXF1ZWNlIGEgbWVtw7NyaWEgZG8gY29udGF0by4gSW52b2NhZG8gcGVsYSBza2lsbCBxdWFuZG8gbyBsZWFkIGNpdGEgYSBlbXByZXNhLgojIEF1dGg6IGhlYWRlciB4LW5pbmEtc2VjcmV0IChOSU5BX1RPT0xTX1NFQ1JFVCkg4oCUIE1FU01PIHBhZHLDo28gZG8gYWdlbmRhci5zaC9uaW5hLXRvb2xzLgojIFVzbzogcGVzcXVpc2FyLnNoIC0tY29udGFjdCA8SUQ+IC0tZW1wcmVzYSAiPG5vbWUgb3UgVVJMPiIKc2V0IC1ldW8gcGlwZWZhaWwKCkVOVl9GSUxFPSIke05JTkFfRU5WX0ZJTEU6LSRIT01FLy5uaW5hLXNkci8uZW52fSIKW1sgLWYgIiRFTlZfRklMRSIgXV0gJiYgeyBzZXQgK3U7IHNvdXJjZSAiJEVOVl9GSUxFIjsgc2V0IC11OyB9CgpDT05UQUNUX0lEPSIiOyBRVUVSWT0iIgp3aGlsZSBbWyAkIyAtZ3QgMCBdXTsgZG8KICBjYXNlICIkMSIgaW4KICAgIC0tY29udGFjdHwtLWNvbnRhY3QtaWQpIENPTlRBQ1RfSUQ9IiQyIjsgc2hpZnQgMjs7CiAgICAtLWVtcHJlc2F8LS11cmx8LS1xdWVyeSkgUVVFUlk9IiQyIjsgc2hpZnQgMjs7CiAgICAqKSBlY2hvICJhcmcgZGVzY29uaGVjaWRvOiAkMSIgPiYyOyBleGl0IDI7OwogIGVzYWMKZG9uZQoKW1sgLXogIiRDT05UQUNUX0lEIiBdXSAmJiB7IGVjaG8gJ3sib2siOmZhbHNlLCJlcnJvciI6Im1pc3NpbmdfY29udGFjdF9pZCJ9JzsgZXhpdCAyOyB9CltbIC16ICIkUVVFUlkiIF1dICAgICAgJiYgeyBlY2hvICd7Im9rIjpmYWxzZSwiZXJyb3IiOiJtaXNzaW5nX2VtcHJlc2EifSc7IGV4aXQgMjsgfQpbWyAteiAiJHtQQU5FTF9CQVNFX1VSTDotfSIgXV0gICAgJiYgeyBlY2hvICd7Im9rIjpmYWxzZSwiZXJyb3IiOiJub19wYW5lbF9iYXNlX3VybCJ9JzsgZXhpdCAxOyB9CltbIC16ICIke05JTkFfVE9PTFNfU0VDUkVUOi19IiBdXSAmJiB7IGVjaG8gJ3sib2siOmZhbHNlLCJlcnJvciI6Im5vX25pbmFfdG9vbHNfc2VjcmV0In0nOyBleGl0IDE7IH0KCkJPRFk9JChweXRob24zIC0gIiRDT05UQUNUX0lEIiAiJFFVRVJZIiA8PCdQWScKaW1wb3J0IGpzb24sIHN5cwpfLCBjb250YWN0LCBxdWVyeSA9IHN5cy5hcmd2CnByaW50KGpzb24uZHVtcHMoeyJjb250YWN0X2lkIjogY29udGFjdCwgInF1ZXJ5IjogcXVlcnl9KSkKUFkKKQoKUkVTUD0kKGN1cmwgLXMgLXcgJCdcbiV7aHR0cF9jb2RlfScgLS1tYXgtdGltZSA5MCAtWCBQT1NUICIke1BBTkVMX0JBU0VfVVJMfS9uaW5hLWVucmljaCIgXAogIC1IICJDb250ZW50LVR5cGU6IGFwcGxpY2F0aW9uL2pzb24iIC1IICJ4LW5pbmEtc2VjcmV0OiAke05JTkFfVE9PTFNfU0VDUkVUfSIgXAogIC1kICIkQk9EWSIgMj4vZGV2L251bGwgfHwgcHJpbnRmICdcbjAwMCcpCmNvZGU9JChwcmludGYgJyVzJyAiJFJFU1AiIHwgdGFpbCAtbjEpOyBwYXlsb2FkPSQocHJpbnRmICclcycgIiRSRVNQIiB8IHNlZCAnJGQnKQpbWyAiJGNvZGUiID1+IF4yIF1dICYmIHsgZWNobyAiJHBheWxvYWQiOyBleGl0IDA7IH0KZWNobyAiJHtwYXlsb2FkOi17XCJva1wiOmZhbHNlLFwiZXJyb3JcIjpcImh0dHBfJHtjb2RlfVwifX0iOyBleGl0IDEK";

// Map slug -> arquivos do pack.
export const PACK_TEMPLATES: Record<string, PackFile[]> = {
  "tratamento-objecoes": [
    { path: "SKILL.md", content: TRATAMENTO_OBJECOES_SKILL },
    { path: "knowledge/objecoes.md", content: TRATAMENTO_OBJECOES_KNOWLEDGE },
  ],
  "pesquisa-empresa": [
    { path: "SKILL.md", content: b64utf8(PESQUISA_EMPRESA_SKILL_B64) },
    { path: "scripts/pesquisar.sh", content: b64utf8(PESQUISA_EMPRESA_SCRIPT_B64) },
  ],
};

export function getPackFiles(slug: string): PackFile[] {
  return PACK_TEMPLATES[slug] ?? [];
}
