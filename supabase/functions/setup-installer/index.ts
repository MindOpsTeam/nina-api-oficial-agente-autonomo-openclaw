/**
 * GET /setup-installer?token=xxx
 * Público (verify_jwt=false). Valida o installer_token (gerado em
 * onboarding-issue-token) e retorna um wrapper bash que:
 *   1. escreve ~/.nina-sdr/.install_env.sh com os env vars do instalador
 *      (PANEL_BASE_URL, PANEL_TOKEN, INSTALLER_TOKEN, ANTHROPIC_API_KEY,
 *       NINA_TOOLS_URL, NINA_TOOLS_SECRET);
 *   2. faz source desse arquivo;
 *   3. baixa e executa o install/setup-nina.sh do repo.
 *
 * IMPORTANTE (correção vs. padrão da carteira): este endpoint NÃO marca o token
 * como usado. Quem consome o installer_token (one-time) é o instance-register,
 * chamado depois pelo setup-nina.sh — ele exige o token NÃO-usado para resolver o
 * dono. Aqui só validamos (existe / não-expirado / não-usado) e o repassamos.
 *
 * Os segredos server-side (PANEL_TOKEN, NINA_TOOLS_SECRET, ANTHROPIC_API_KEY)
 * vivem no Vault e são lidos via getSecret — nunca expostos ao cliente além do
 * script que o próprio dono executa na sua VPS.
 */
import { adminClient } from "../_shared/panel.ts";
import { getSecret } from "../_shared/secrets.ts";

// Raw URL do setup-nina.sh no repo (sobrescrevível por env para dev/branch).
const SETUP_NINA_URL = Deno.env.get("SETUP_NINA_URL") ??
  "https://raw.githubusercontent.com/MindOpsTeam/nina-api-oficial-agente-autonomo-openclaw/main/install/setup-nina.sh";

// Aspas simples seguras para heredoc/bash.
function shEscape(v: string): string {
  return `'${String(v).replace(/'/g, "'\\''")}'`;
}

function errScript(comment: string, status: number): Response {
  return new Response(`#!/usr/bin/env bash\n# ${comment}\nexit 1\n`, {
    status,
    headers: { "Content-Type": "text/x-shellscript; charset=utf-8", "Cache-Control": "no-store" },
  });
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) return errScript("erro: token ausente", 400);

  const admin = adminClient();
  const { data: row } = await admin
    .from("installer_tokens")
    .select("token, owner_user_id, expires_at, used_at")
    .eq("token", token)
    .maybeSingle();

  if (!row) return errScript("erro: token invalido", 404);
  if (row.used_at) return errScript("erro: token ja utilizado", 410);
  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    return errScript("erro: token expirado", 410);
  }

  // Base URL das edge functions (mesmo padrão do onboarding-issue-token).
  const baseUrl = Deno.env.get("SUPABASE_URL")!;
  const panelBaseUrl = `${baseUrl}/functions/v1`;
  const ninaToolsUrl = `${panelBaseUrl}/nina-tools`;

  const panelToken = (await getSecret("PANEL_TOKEN")) ?? "";
  const ninaToolsSecret = (await getSecret("NINA_TOOLS_SECRET")) ?? "";
  const anthropicKey = (await getSecret("ANTHROPIC_API_KEY")) ?? "";
  // T3 — token read-only pra VPS puxar o branch nina-brain (repo privado).
  const brainToken = (await getSecret("GITHUB_BRAIN_TOKEN")) ?? "";
  // P0 — Named Cloudflare Tunnel (ingress de produção, URL fixa). Opcional: se
  // ambos estiverem no Vault, a VPS usa named tunnel; senão cai no quick tunnel.
  const cfTunnelToken = (await getSecret("CF_TUNNEL_TOKEN")) ?? "";
  const cfTunnelHostname = (await getSecret("CF_TUNNEL_HOSTNAME")) ?? "";

  // SKILL_REPO: repo de cérebro DO CLIENTE (a VPS instala/sincroniza a skill do
  // branch nina-brain DESSE repo, não do original hardcoded). Fallback single-tenant
  // (igual orchestrator/brain-build): owner -> global (user_id NULL) -> qualquer linha.
  // URL tokenless (o brain_sync injeta o GITHUB_BRAIN_TOKEN inline no fetch).
  let brainRepoUrl = "";
  {
    const byOwner = await admin.from("nina_settings").select("brain_repo_url").eq("user_id", row.owner_user_id).maybeSingle();
    brainRepoUrl = (byOwner.data?.brain_repo_url ?? "").trim();
    if (!brainRepoUrl) {
      const global = await admin.from("nina_settings").select("brain_repo_url").is("user_id", null).maybeSingle();
      brainRepoUrl = (global.data?.brain_repo_url ?? "").trim();
    }
    if (!brainRepoUrl) {
      const anyRow = await admin.from("nina_settings").select("brain_repo_url").limit(1).maybeSingle();
      brainRepoUrl = (anyRow.data?.brain_repo_url ?? "").trim();
    }
  }

  const envLines = [
    `export PANEL_BASE_URL=${shEscape(panelBaseUrl)}`,
    `export PANEL_TOKEN=${shEscape(panelToken)}`,
    `export INSTALLER_TOKEN=${shEscape(token)}`,
    `export ANTHROPIC_API_KEY=${shEscape(anthropicKey)}`,
    `export NINA_TOOLS_URL=${shEscape(ninaToolsUrl)}`,
    `export NINA_TOOLS_SECRET=${shEscape(ninaToolsSecret)}`,
    `export GITHUB_BRAIN_TOKEN=${shEscape(brainToken)}`,
  ];

  // Só emite SKILL_REPO se houver brain_repo_url; senão o setup-nina.sh cai no
  // default (skill genérica) — comportamento atual, sem quebrar.
  if (brainRepoUrl) {
    envLines.push(`export SKILL_REPO=${shEscape(brainRepoUrl)}`);
  }

  // Named tunnel (P0): só emite se token + hostname existirem; senão a VPS usa
  // o quick tunnel (default zero-config / fallback) — sem quebrar.
  if (cfTunnelToken && cfTunnelHostname) {
    envLines.push(`export CF_TUNNEL_TOKEN=${shEscape(cfTunnelToken)}`);
    envLines.push(`export CF_TUNNEL_HOSTNAME=${shEscape(cfTunnelHostname)}`);
  }

  const script = `#!/usr/bin/env bash
# Nina SDR — installer (gerado pelo painel)
set -euo pipefail

echo "==> Configurando variaveis de ambiente do agente Nina..."
mkdir -p "$HOME/.nina-sdr"
cat > "$HOME/.nina-sdr/.install_env.sh" <<'NINA_ENV_EOF'
${envLines.join("\n")}
NINA_ENV_EOF
chmod 600 "$HOME/.nina-sdr/.install_env.sh"
# shellcheck disable=SC1091
source "$HOME/.nina-sdr/.install_env.sh"

echo "==> Baixando e executando setup-nina.sh..."
curl -fsSL ${SETUP_NINA_URL} | bash
`;

  return new Response(script, {
    status: 200,
    headers: {
      "Content-Type": "text/x-shellscript; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
});
