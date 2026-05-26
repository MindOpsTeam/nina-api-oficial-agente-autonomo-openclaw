#!/usr/bin/env bash
# heartbeat.sh — Heartbeat ao painel (POST {PANEL_BASE_URL}/heartbeat).
# Chamado pelo cron */5. Antes de enviar, re-detecta a URL do Cloudflare Tunnel
# (quick tunnels trocam de URL a cada restart) e atualiza o .env.
# Body: { instance_id, ingress_url, system_prompt, openclaw_version }
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/_shared.sh"

LOG_FILE="$LOG_DIR/heartbeat.log"
_ENV_FILE="${NINA_ENV_FILE:-$HOME/.nina-sdr/.env}"

# system_prompt = identity.md + soul.md da skill (persona da Nina).
_ID_DIR="${SCRIPT_DIR}/../identity"
_PERSONA=""
[[ -f "${_ID_DIR}/identity.md" ]] && _PERSONA="$(< "${_ID_DIR}/identity.md")"
[[ -f "${_ID_DIR}/soul.md" ]]     && _PERSONA="${_PERSONA}${_PERSONA:+$'\n\n'}$(< "${_ID_DIR}/soul.md")"

# Re-detectar URL do tunnel (journalctl → logfile → fallback).
_detect_tunnel_url() {
    local d=""
    command -v journalctl &>/dev/null && d=$(journalctl -u cloudflared-nina -n 100 --no-pager 2>/dev/null \
        | grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' | tail -1 || true)
    if [[ -z "$d" ]]; then
        for lp in "/var/log/cloudflared-nina.log" "${HOME}/.nina-sdr/logs/cloudflared.log" "/tmp/cloudflared-nina.log"; do
            [[ -f "$lp" ]] && d=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$lp" 2>/dev/null | tail -1 || true)
            [[ -n "$d" ]] && break
        done
    fi
    echo "${d:-}"
}

NEW_URL=$(_detect_tunnel_url || true)
if [[ -n "$NEW_URL" && "$NEW_URL" != "${INGRESS_URL:-}" ]]; then
    echo "[$(date '+%F %T')] tunnel url: ${INGRESS_URL:-vazio} → $NEW_URL" >> "$LOG_FILE"
    INGRESS_URL="$NEW_URL"
    if [[ -f "$_ENV_FILE" ]]; then
        grep -q "^INGRESS_URL=" "$_ENV_FILE" \
            && sed -i "s|^INGRESS_URL=.*|INGRESS_URL=${NEW_URL}|" "$_ENV_FILE" \
            || echo "INGRESS_URL=${NEW_URL}" >> "$_ENV_FILE"
    fi
fi

[[ -z "${INSTANCE_ID:-}" ]] && { echo "[$(date '+%F %T')] sem INSTANCE_ID — heartbeat abortado" >> "$LOG_FILE"; exit 0; }

OPENCLAW_VER=$(openclaw --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 || echo "")
SP_JSON=$(_json_str "$_PERSONA")

BODY="{\"instance_id\":$(_json_str "$INSTANCE_ID")"
[[ -n "${INGRESS_URL:-}" ]]  && BODY="${BODY},\"ingress_url\":$(_json_str "$INGRESS_URL")"
[[ -n "$_PERSONA" ]]         && BODY="${BODY},\"system_prompt\":${SP_JSON}"
[[ -n "$OPENCLAW_VER" ]]     && BODY="${BODY},\"openclaw_version\":$(_json_str "$OPENCLAW_VER")"
BODY="${BODY}}"

_panel_post "heartbeat" "$BODY" >/dev/null && \
    echo "[$(date '+%F %T')] heartbeat ok — instance=${INSTANCE_ID} ingress=${INGRESS_URL:-vazio}" >> "$LOG_FILE" || \
    echo "[$(date '+%F %T')] heartbeat FALHOU" >> "$LOG_FILE"
