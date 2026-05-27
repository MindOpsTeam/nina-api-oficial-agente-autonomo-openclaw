#!/usr/bin/env bash
# setup-nina.sh — Instalador da VPS do agente Nina SDR (OpenClaw self-hosted).
# V1 ENXUTO: 1 skill (nina) + ciclo de vida essencial (gateway + cloudflared +
# auto-registro + heartbeat). Adaptado do padrão do agente-cfo.
#
# Fluxo Nina: o app (nina-orchestrator, F3c) entrega mensagens via POST
# {ingress_url}/hooks/agent (Bearer HOOKS_TOKEN). A skill 'nina' pensa como SDR e
# responde chamando nina_reply.sh (-> /nina-reply -> send_queue -> whatsapp-sender);
# se for agendar, chama agendar.sh (-> /nina-tools).
#
# Env esperados (escritos pelo setup-installer em ~/.nina-sdr/.install_env.sh):
#   PANEL_BASE_URL PANEL_TOKEN INSTALLER_TOKEN ANTHROPIC_API_KEY
#   NINA_TOOLS_URL NINA_TOOLS_SECRET
set -euo pipefail

# ── Aparência ─────────────────────────────────────────────────────────────────
NC=$'\033[0m'; CYAN=$'\033[0;36m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[0;33m'; RED=$'\033[0;31m'
info() { echo -e "${CYAN}›${NC} $*"; }
ok()   { echo -e "${GREEN}✓${NC} $*"; }
warn() { echo -e "${YELLOW}!${NC} $*"; }
fail() { echo -e "${RED}✗${NC} $*" >&2; exit 1; }

# ── Constantes ────────────────────────────────────────────────────────────────
SKILL_REPO="${SKILL_REPO:-https://github.com/MindOpsTeam/nina-api-oficial-agente-autonomo-openclaw.git}"
SKILL_BRANCH="${SKILL_BRANCH:-main}"
# Brain Build (T3): branch dedicado do repo do cliente com identity/soul/knowledge
# da Nina. A VPS rastreia esse branch e puxa atualizações (hot-reload do OpenClaw).
BRAIN_BRANCH="${BRAIN_BRANCH:-nina-brain}"
SKILL_NAME="nina"
WS_ROOT="${HOME}/.openclaw/workspace"
SKILL_DEST="${WS_ROOT}/skills/${SKILL_NAME}"
STATE_DIR="${HOME}/.nina-sdr"
ENV_FILE="${STATE_DIR}/.env"
LOG_DIR="${STATE_DIR}/logs"
BRAIN_DIR="${STATE_DIR}/brain"   # clone git que rastreia nina-brain (read-only via token)
GW_PORT=18789

mkdir -p "$STATE_DIR" "$LOG_DIR" "${WS_ROOT}/skills"

# ── Carregar env ─────────────────────────────────────────────────────────────
# Ordem importa: o .env (re-execução) entra PRIMEIRO como base; o .install_env.sh
# (valores frescos do setup-installer) entra POR ÚLTIMO e SEMPRE sobrescreve —
# assim um install fresco vence um .env velho de uma instalação anterior na VPS.
[[ -f "$ENV_FILE" ]] && { info "Reusando ${ENV_FILE} (re-execução)."; set -a; source "$ENV_FILE"; set +a; }
[[ -f "${STATE_DIR}/.install_env.sh" ]] && { set -a; source "${STATE_DIR}/.install_env.sh"; set +a; }

: "${PANEL_BASE_URL:?PANEL_BASE_URL ausente (rode via setup-installer)}"
: "${PANEL_TOKEN:?PANEL_TOKEN ausente}"
: "${INSTALLER_TOKEN:?INSTALLER_TOKEN ausente}"

# ═══════════════════════════════════════════════════════════════════════════════
# PASSO 1 — Preflight: Node 22.12+ e dependências
# ═══════════════════════════════════════════════════════════════════════════════
_install_node22() {
    info "Instalando Node 22 LTS via NodeSource..."
    command -v curl &>/dev/null || apt-get install -y curl -q
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - 2>&1 | tail -5
    apt-get install -y nodejs 2>&1 | tail -5
    ok "Node.js $(node --version) instalado."
}
_ensure_node22() {
    if command -v node &>/dev/null; then
        local maj min; maj=$(node --version | tr -d 'v' | cut -d. -f1); min=$(node --version | tr -d 'v' | cut -d. -f2)
        if [[ "$maj" -gt 22 ]] || { [[ "$maj" -eq 22 ]] && [[ "$min" -ge 12 ]]; }; then
            ok "Node.js $(node --version) — OK."; return
        fi
        warn "Node.js $(node --version) < 22.12 (OpenClaw exige 22.12+)."
    else
        warn "Node.js não encontrado."
    fi
    _install_node22
}
_ensure_node22

MISSING=()
for bin in npm python3 curl jq git openssl; do
    command -v "$bin" &>/dev/null || MISSING+=("$bin")
done
[[ ${#MISSING[@]} -gt 0 ]] && fail "Dependências ausentes: ${MISSING[*]}
Instale: apt-get update && apt-get install -y npm python3 curl jq git openssl"
ok "Dependências base OK."

# ═══════════════════════════════════════════════════════════════════════════════
# PASSO 2 — OpenClaw + otimizações VPS
# ═══════════════════════════════════════════════════════════════════════════════
info "Instalando/atualizando OpenClaw..."
npm install -g openclaw@latest 2>&1 | tail -3 || fail "Falha ao instalar OpenClaw."
ok "OpenClaw: $(openclaw --version 2>/dev/null | head -1)"

if ! grep -q 'OPENCLAW_NO_RESPAWN' "${HOME}/.bashrc" 2>/dev/null; then
    cat >> "${HOME}/.bashrc" <<'EOF'
export NODE_COMPILE_CACHE=/var/tmp/openclaw-compile-cache
export OPENCLAW_NO_RESPAWN=1
EOF
fi
export NODE_COMPILE_CACHE=/var/tmp/openclaw-compile-cache
mkdir -p /var/tmp/openclaw-compile-cache
export OPENCLAW_NO_RESPAWN=1

# ═══════════════════════════════════════════════════════════════════════════════
# PASSO 3 — Tokens
# ═══════════════════════════════════════════════════════════════════════════════
if [[ -z "${HOOKS_TOKEN:-}" ]]; then HOOKS_TOKEN=$(openssl rand -hex 16); ok "HOOKS_TOKEN gerado."; fi
mkdir -p "${HOME}/.openclaw"
if ! python3 -c "import json,os,sys; t=json.load(open(os.path.expanduser('~/.openclaw/openclaw.json'))).get('gateway',{}).get('auth',{}).get('token'); sys.exit(0 if t else 1)" 2>/dev/null; then
    GW_TOKEN=$(openssl rand -hex 24)
    openclaw config set gateway.auth.token "$GW_TOKEN" 2>&1 | grep -v "^Config overwrite" || true
    ok "gateway.auth.token gerado."
fi

# ═══════════════════════════════════════════════════════════════════════════════
# PASSO 4 — Config do gateway (mode/auth/controlUi/tools/hooks)
# ═══════════════════════════════════════════════════════════════════════════════
info "Configurando OpenClaw..."
openclaw config set gateway.mode local                                    2>&1 | grep -v "^Config overwrite" || true
openclaw config set gateway.auth.mode token                               2>&1 | grep -v "^Config overwrite" || true
openclaw config set 'gateway.controlUi.allowedOrigins' '["*"]'            2>&1 | grep -v "^Config overwrite" || true
openclaw config set 'gateway.controlUi.dangerouslyDisableDeviceAuth' true 2>&1 | grep -v "^Config overwrite" || true
openclaw config set tools.profile coding                                  2>&1 | grep -v "^Config overwrite" || warn "tools.profile falhou."
openclaw config set hooks.enabled true                                    2>&1 | grep -v "^Config overwrite" || warn "hooks.enabled falhou."
openclaw config set hooks.token "$HOOKS_TOKEN"                            2>&1 | grep -v "^Config overwrite" || warn "hooks.token falhou."
ok "Gateway configurado (hooks token: ${HOOKS_TOKEN:0:8}...)."

# Approvals: permitir execução não-interativa dos scripts da skill nina.
for _pat in \
    "${SKILL_DEST}/scripts/*.sh" \
    "${WS_ROOT}/skills/*/scripts/*.sh"
do
    openclaw approvals allowlist add "$_pat" 2>/dev/null || warn "approvals allowlist '${_pat}' (pode já existir)."
done

# ═══════════════════════════════════════════════════════════════════════════════
# PASSO 5 — Provider Anthropic (claude-sonnet-4-6)
# ═══════════════════════════════════════════════════════════════════════════════
if [[ -n "${ANTHROPIC_API_KEY:-}" ]]; then
    info "Configurando provider Anthropic..."
    _AP=$(mktemp /tmp/nina-anthropic-XXXXXX.json5)
    cat > "$_AP" <<'ANTEOF'
{
  "models": {
    "providers": {
      "anthropic": {
        "baseUrl": "https://api.anthropic.com",
        "apiKey": { "source": "env", "provider": "anthropic", "id": "ANTHROPIC_API_KEY" },
        "maxTokens": 4096,
        "models": [
          { "id": "claude-sonnet-4-6", "name": "Claude Sonnet 4.6", "api": "anthropic-messages", "input": ["text", "image"], "maxTokens": 4096 }
        ]
      }
    }
  },
  "secrets": { "providers": { "anthropic": { "source": "env", "allowlist": ["ANTHROPIC_API_KEY"] } } },
  "agents": { "defaults": { "model": { "primary": "anthropic/claude-sonnet-4-6" } } }
}
ANTEOF
    openclaw config patch --file "$_AP" 2>&1 | tail -3 || warn "config patch Anthropic falhou."
    rm -f "$_AP"
    openclaw models set anthropic/claude-sonnet-4-6 2>/dev/null || warn "models set falhou."
    ok "Anthropic configurado (claude-sonnet-4-6)."
else
    warn "ANTHROPIC_API_KEY ausente — o agente não conseguirá pensar até configurar um provider."
fi

# ═══════════════════════════════════════════════════════════════════════════════
# PASSO 6 — Instalar skill nina + AGENTS.md/SOUL.md
# ═══════════════════════════════════════════════════════════════════════════════
# Monta URL https autenticada (token só em runtime; não persiste no .git/config).
_auth_url() {
    local u="$1"
    [[ -n "${GITHUB_BRAIN_TOKEN:-}" ]] && echo "${u/https:\/\//https://x-access-token:${GITHUB_BRAIN_TOKEN}@}" || echo "$u"
}

_install_skill() {
    local auth; auth="$(_auth_url "$SKILL_REPO")"
    # Escolhe o branch inicial: nina-brain se JÁ existir no remoto; senão o default
    # (skill genérica) — sem quebrar. O cron sempre puxa nina-brain depois.
    local branch="$SKILL_BRANCH"
    if git ls-remote --heads "$auth" "$BRAIN_BRANCH" 2>/dev/null | grep -q "refs/heads/${BRAIN_BRANCH}"; then
        branch="$BRAIN_BRANCH"; ok "Branch '${BRAIN_BRANCH}' existe — instalando Brain Build do cliente."
    else
        warn "Branch '${BRAIN_BRANCH}' ainda não existe — instalando skill genérica de '${SKILL_BRANCH}' (o cron puxa quando aparecer)."
    fi

    # Clone persistente (raso, sparse) — fonte da skill e alvo do pull do cron.
    if [[ ! -d "$BRAIN_DIR/.git" ]]; then
        rm -rf "$BRAIN_DIR"
        git clone --depth 1 --branch "$branch" --filter=blob:none --sparse "$auth" "$BRAIN_DIR" 2>/dev/null \
            || fail "Falha ao clonar $SKILL_REPO ($branch). Repo privado? Confira GITHUB_BRAIN_TOKEN."
        ( cd "$BRAIN_DIR" && git sparse-checkout set "skills/${SKILL_NAME}" "install/templates" )
        git -C "$BRAIN_DIR" remote set-url origin "$SKILL_REPO"   # tira o token do remote persistido
    fi

    [[ -d "$BRAIN_DIR/skills/${SKILL_NAME}" ]] || fail "skills/${SKILL_NAME} ausente no branch ${branch}."
    # Deploy inicial COMPLETO (inclui scripts). O sync subsequente preserva scripts/.
    rm -rf "$SKILL_DEST"; cp -r "$BRAIN_DIR/skills/${SKILL_NAME}" "$SKILL_DEST"
    [[ -f "$BRAIN_DIR/install/templates/AGENTS-nina.md" ]] && cp "$BRAIN_DIR/install/templates/AGENTS-nina.md" "${WS_ROOT}/AGENTS.md"
    [[ -f "$BRAIN_DIR/install/templates/SOUL-nina.md" ]]   && cp "$BRAIN_DIR/install/templates/SOUL-nina.md"   "${WS_ROOT}/SOUL.md"
    chmod +x "$SKILL_DEST/scripts/"*.sh 2>/dev/null || true
    ok "Skill ${SKILL_NAME} instalada (branch ${branch}) em ${SKILL_DEST}."
}
_install_skill
# Fallback: se templates não vieram, usa o identity da skill como SOUL.
[[ ! -f "${WS_ROOT}/SOUL.md" && -f "${SKILL_DEST}/identity/soul.md" ]] && cp "${SKILL_DEST}/identity/soul.md" "${WS_ROOT}/SOUL.md"

# ═══════════════════════════════════════════════════════════════════════════════
# PASSO 7 — Persistir .env (ANTES do systemd: o unit usa EnvironmentFile)
# ═══════════════════════════════════════════════════════════════════════════════
cat > "$ENV_FILE" <<EOF
# Nina SDR — gerado por setup-nina.sh em $(date '+%Y-%m-%d %H:%M:%S')
PANEL_BASE_URL=${PANEL_BASE_URL}
PANEL_TOKEN=${PANEL_TOKEN}
INSTALLER_TOKEN=${INSTALLER_TOKEN}
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-}
NINA_TOOLS_URL=${NINA_TOOLS_URL:-${PANEL_BASE_URL}/nina-tools}
NINA_TOOLS_SECRET=${NINA_TOOLS_SECRET:-}
HOOKS_TOKEN=${HOOKS_TOKEN}
INGRESS_URL=${INGRESS_URL:-}
INSTANCE_ID=${INSTANCE_ID:-}
# Brain Build (T3) — pull do branch nina-brain (read-only)
GITHUB_BRAIN_TOKEN=${GITHUB_BRAIN_TOKEN:-}
BRAIN_REPO=${SKILL_REPO}
BRAIN_BRANCH=${BRAIN_BRANCH}
BRAIN_DIR=${BRAIN_DIR}
SKILL_DEST=${SKILL_DEST}
EOF
chmod 600 "$ENV_FILE"
ok "Env persistido em ${ENV_FILE}."

# ═══════════════════════════════════════════════════════════════════════════════
# PASSO 8 — cloudflared + systemd units (gateway + tunnel)
# ═══════════════════════════════════════════════════════════════════════════════
if ! command -v cloudflared &>/dev/null; then
    info "Instalando cloudflared..."
    case "$(uname -m)" in
        x86_64) _CFA=amd64 ;; aarch64) _CFA=arm64 ;; *) fail "Arch não suportada: $(uname -m)";;
    esac
    curl -fsSL "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${_CFA}" -o /usr/local/bin/cloudflared
    chmod +x /usr/local/bin/cloudflared
    ok "cloudflared instalado."
fi

_OPENCLAW_BIN="$(command -v openclaw)"; _CF_BIN="$(command -v cloudflared)"; _USER_NAME="${USER:-root}"

cat > /etc/systemd/system/openclaw-gateway.service <<EOF
[Unit]
Description=OpenClaw Gateway (Nina SDR)
After=network.target

[Service]
Type=simple
User=${_USER_NAME}
Environment=HOME=${HOME}
Environment=OPENCLAW_NO_RESPAWN=1
Environment=NODE_COMPILE_CACHE=/var/tmp/openclaw-compile-cache
EnvironmentFile=${ENV_FILE}
ExecStart=${_OPENCLAW_BIN} gateway run --port ${GW_PORT} --bind loopback
Restart=always
RestartSec=5
TimeoutStartSec=90

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/cloudflared-nina.service <<EOF
[Unit]
Description=Cloudflare Tunnel (Nina SDR)
After=network.target openclaw-gateway.service

[Service]
Type=simple
User=${_USER_NAME}
ExecStart=${_CF_BIN} tunnel --url http://localhost:${GW_PORT} --no-autoupdate
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload 2>/dev/null || true
systemctl enable --now openclaw-gateway 2>/dev/null || warn "enable openclaw-gateway falhou."

info "Aguardando gateway na porta ${GW_PORT} (até 60s)..."
for _i in $(seq 1 30); do
    ss -tlnp 2>/dev/null | grep -q ":${GW_PORT}" && { ok "Gateway pronto (~$((_i*2))s)."; break; }
    sleep 2
done

# ═══════════════════════════════════════════════════════════════════════════════
# PASSO 9 — Cloudflare Tunnel: subir e extrair INGRESS_URL
# ═══════════════════════════════════════════════════════════════════════════════
systemctl enable --now cloudflared-nina 2>/dev/null || warn "enable cloudflared-nina falhou."
info "Aguardando URL do Cloudflare Tunnel (até 60s)..."
INGRESS_URL=""
for _i in $(seq 1 30); do
    sleep 2
    INGRESS_URL=$(journalctl -u cloudflared-nina -n 80 --no-pager 2>/dev/null \
        | grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' | tail -1 || echo "")
    [[ -n "$INGRESS_URL" ]] && break
done
[[ -z "$INGRESS_URL" ]] && fail "Não foi possível capturar a URL do Tunnel. Cheque: journalctl -u cloudflared-nina"
ok "Tunnel ativo: ${INGRESS_URL}"
sed -i "s|^INGRESS_URL=.*|INGRESS_URL=${INGRESS_URL}|" "$ENV_FILE"

# ═══════════════════════════════════════════════════════════════════════════════
# PASSO 10 — Auto-registro no painel (instance-register)
# ═══════════════════════════════════════════════════════════════════════════════
OPENCLAW_VER=$(openclaw --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 || echo "unknown")
DASHBOARD_TOKEN=$(python3 -c "import json,os;print(json.load(open(os.path.expanduser('~/.openclaw/openclaw.json'))).get('gateway',{}).get('auth',{}).get('token',''))" 2>/dev/null || echo "")

REGISTER_BODY=$(python3 - "$INSTALLER_TOKEN" "$(hostname)" "$OPENCLAW_VER" "$INGRESS_URL" "$HOOKS_TOKEN" "$DASHBOARD_TOKEN" <<'PY'
import json, sys
_, inst, host, ver, ingress, hooks, dash = sys.argv
print(json.dumps({
    "installer_token": inst, "hostname": host, "openclaw_version": ver,
    "ingress_url": ingress, "hooks_token": hooks,
    "openclaw_dashboard_token": dash, "agent_type": "nina_sdr",
}))
PY
)
REGISTER_RESP=$(curl -s --max-time 30 -X POST "${PANEL_BASE_URL}/instance-register" \
    -H "Content-Type: application/json" -H "X-Panel-Token: ${PANEL_TOKEN}" -d "$REGISTER_BODY")
INSTANCE_ID=$(printf '%s' "$REGISTER_RESP" | python3 -c "import sys,json;print(json.loads(sys.stdin.read()).get('instance_id',''))" 2>/dev/null || echo "")
[[ -z "$INSTANCE_ID" ]] && fail "Falha ao registrar no painel. Resposta: $REGISTER_RESP"
sed -i "s|^INSTANCE_ID=.*|INSTANCE_ID=${INSTANCE_ID}|" "$ENV_FILE"
ok "Instância registrada: ${INSTANCE_ID}"

# ═══════════════════════════════════════════════════════════════════════════════
# PASSO 11 — Cron heartbeat (*/5): re-detecta ingress + manda system_prompt
# ═══════════════════════════════════════════════════════════════════════════════
_HB_LINE="*/5 * * * * /usr/bin/env bash ${SKILL_DEST}/scripts/heartbeat.sh >> ${LOG_DIR}/heartbeat.log 2>&1"
_BS_LINE="*/2 * * * * /usr/bin/env bash ${SKILL_DEST}/scripts/brain_sync.sh >> ${LOG_DIR}/brain_sync.log 2>&1"
( crontab -l 2>/dev/null \
    | grep -v "skills/${SKILL_NAME}/scripts/heartbeat.sh" \
    | grep -v "skills/${SKILL_NAME}/scripts/brain_sync.sh" \
  ; echo "$_HB_LINE" ; echo "$_BS_LINE" ) | crontab - 2>/dev/null \
    && ok "Crons registrados (heartbeat */5 + brain-sync */2)." || warn "Falha ao registrar crons."

echo
ok "=========================================="
ok " Nina SDR instalada e registrada!"
ok " instance_id : ${INSTANCE_ID}"
ok " ingress_url : ${INGRESS_URL}"
ok " env         : ${ENV_FILE}"
ok "=========================================="
