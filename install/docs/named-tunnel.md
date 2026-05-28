# Ingress de produção — Named Cloudflare Tunnel (P0, Opção A)

Por padrão a VPS sobe um **quick tunnel** (`*.trycloudflare.com`): zero-config, ótimo
para trial/dev, mas a URL **muda a cada restart**. Para **produção**, use um
**Named Cloudflare Tunnel**: URL **fixa**, HTTPS na borda da Cloudflare, sem abrir
portas na VPS, atrás de NAT. Isso elimina o GAP7 (URL stale).

## O que muda
- A VPS roda `cloudflared tunnel run` por **token** (em vez do `--url` efêmero).
- O `ingress_url` passa a ser o **hostname fixo** que você configurou.
- O heartbeat **não re-detecta** URL (ela não muda).

## Passo a passo do cliente (uma vez)
1. Tenha um **domínio na Cloudflare** (qualquer plano, inclusive free) e o
   **Cloudflare Zero Trust** habilitado (também free).
2. Em **Zero Trust → Networks → Tunnels → Create a tunnel → Cloudflared**:
   - dê um nome (ex.: `nina-sdr`);
   - copie o **token do tunnel** (a string longa do comando `cloudflared service install <TOKEN>`).
3. Na aba **Public Hostname** do tunnel, adicione uma rota:
   - **Subdomain/Domain:** ex. `nina.suaempresa.com`;
   - **Service:** `HTTP` → `localhost:18789`.
4. Entregue ao painel (vão para o Vault):
   - `CF_TUNNEL_TOKEN` = o token do passo 2;
   - `CF_TUNNEL_HOSTNAME` = o hostname do passo 3 (ex.: `nina.suaempresa.com`).
5. Rode o instalador normalmente (o mesmo comando SSH). Com os dois valores
   presentes, a VPS entra automaticamente em **modo named** e registra a URL fixa
   `https://<CF_TUNNEL_HOSTNAME>` no painel.

## Verificação
```bash
systemctl status cloudflared-nina      # connector "registered/active"
curl -H "Authorization: Bearer <HOOKS_TOKEN>" https://<CF_TUNNEL_HOSTNAME>/health
# -> {"ok":true,...}
```

## Sem os dois valores?
A VPS continua no **quick tunnel** (default/fallback) — nada quebra. Migrar para
named depois é só preencher os dois segredos e re-rodar o instalador.
