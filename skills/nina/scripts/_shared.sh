#!/usr/bin/env bash
# _shared.sh — Helpers compartilhados dos scripts da skill Nina.
# NÃO execute diretamente. Use: source "$SCRIPT_DIR/_shared.sh"

# ── Carregar env ──────────────────────────────────────────────────────────────
_ENV_FILE="${NINA_ENV_FILE:-$HOME/.nina-sdr/.env}"
if [[ -f "$_ENV_FILE" ]]; then
    set +u; source "$_ENV_FILE"; set -u
fi

PANEL_BASE_URL="${PANEL_BASE_URL:-}"
LOG_DIR="${NINA_LOG_DIR:-$HOME/.nina-sdr/logs}"
mkdir -p "$LOG_DIR"

# ── _json_str(value) → string JSON-escaped (com aspas) ────────────────────────
_json_str() {
    printf '%s' "${1:-}" | python3 -c "import sys,json;print(json.dumps(sys.stdin.read()))" 2>/dev/null || echo '""'
}

# ── _panel_post(path, json_body) → ecoa resposta; retry/backoff em falha/5xx ──
# Auth VPS→app via header X-Panel-Token. Usado por nina_reply e heartbeat.
_panel_post() {
    local path="$1" body="$2"
    [[ -z "${PANEL_BASE_URL:-}" ]] && { echo '{"error":"no_panel_base_url"}'; return 1; }
    [[ -z "${PANEL_TOKEN:-}" ]]    && { echo '{"error":"no_panel_token"}'; return 1; }

    local url="${PANEL_BASE_URL}/${path}"
    local attempt=0 max=3 delay=2 resp http_code
    while :; do
        attempt=$((attempt+1))
        resp=$(curl -s -w $'\n%{http_code}' --max-time 20 -X POST "$url" \
            -H "Content-Type: application/json" -H "X-Panel-Token: ${PANEL_TOKEN}" \
            -d "$body" 2>>"$LOG_DIR/panel.log" || printf '\n000')
        http_code=$(printf '%s' "$resp" | tail -n1)
        local payload; payload=$(printf '%s' "$resp" | sed '$d')
        if [[ "$http_code" =~ ^2 ]]; then printf '%s' "$payload"; return 0; fi
        # Retry só em erro de conexão (000) ou 5xx; 4xx é definitivo.
        if [[ "$http_code" == "000" || "$http_code" =~ ^5 ]] && [[ $attempt -lt $max ]]; then
            printf '[%s] _panel_post %s -> HTTP %s (retry %d/%d)\n' "$(date +%FT%T)" "$path" "$http_code" "$attempt" "$max" >> "$LOG_DIR/panel.log"
            sleep "$delay"; delay=$((delay*2)); continue
        fi
        printf '[%s] _panel_post %s -> HTTP %s body=%s\n' "$(date +%FT%T)" "$path" "$http_code" "$payload" >> "$LOG_DIR/panel.log"
        printf '%s' "$payload"; return 1
    done
}
