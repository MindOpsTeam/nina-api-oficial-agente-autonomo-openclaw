#!/usr/bin/env bash
# agendar.sh — Cria/reagenda/cancela consulta via nina-tools (F2).
# POST {NINA_TOOLS_URL} (header x-nina-secret) {action, contact_id, conversation_id, user_id, args}
# Retorna o JSON do backend: {ok:true, appointment:{...}} ou {ok:false, error:"..."}.
#
# Uso (a skill chama via exec):
#   agendar.sh --action create|reschedule|cancel --contact <ID> [--conversation <ID>] [--user <ID>] --args '<JSON>'
#   ex args create:    '{"date":"2026-05-27","time":"14:00"}'
#   ex args reschedule:'{"new_date":"2026-05-28","new_time":"15:00"}'
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/_shared.sh"

ACTION=""; CONTACT_ID=""; CONVERSATION_ID=""; USER_ID=""; ARGS_JSON="{}"
while [[ $# -gt 0 ]]; do
    case "$1" in
        --action)       ACTION="$2"; shift 2;;
        --contact|--contact-id) CONTACT_ID="$2"; shift 2;;
        --conversation|--conversation-id) CONVERSATION_ID="$2"; shift 2;;
        --user|--user-id) USER_ID="$2"; shift 2;;
        --args)         ARGS_JSON="$2"; shift 2;;
        *) echo "arg desconhecido: $1" >&2; exit 2;;
    esac
done

case "$ACTION" in create|reschedule|cancel) ;; *) echo '{"ok":false,"error":"invalid_action"}'; exit 2;; esac
[[ -z "$CONTACT_ID" ]] && { echo '{"ok":false,"error":"missing_contact_id"}'; exit 2; }
[[ -z "${NINA_TOOLS_URL:-}" ]] && { echo '{"ok":false,"error":"no_nina_tools_url"}'; exit 1; }
[[ -z "${NINA_TOOLS_SECRET:-}" ]] && { echo '{"ok":false,"error":"no_nina_tools_secret"}'; exit 1; }

BODY=$(python3 - "$ACTION" "$CONTACT_ID" "$CONVERSATION_ID" "$USER_ID" "$ARGS_JSON" <<'PY'
import json, sys
_, action, contact, conv, user, args = sys.argv
try:
    args_obj = json.loads(args) if args else {}
except Exception:
    args_obj = {}
print(json.dumps({
    "action": action,
    "contact_id": contact,
    "conversation_id": conv or None,
    "user_id": user or None,
    "args": args_obj,
}))
PY
)

attempt=0; max=3; delay=2
while :; do
    attempt=$((attempt+1))
    RESP=$(curl -s -w $'\n%{http_code}' --max-time 25 -X POST "$NINA_TOOLS_URL" \
        -H "Content-Type: application/json" -H "x-nina-secret: ${NINA_TOOLS_SECRET}" \
        -d "$BODY" 2>>"$LOG_DIR/agendar.log" || printf '\n000')
    code=$(printf '%s' "$RESP" | tail -n1); payload=$(printf '%s' "$RESP" | sed '$d')
    if [[ "$code" =~ ^2 ]]; then echo "$payload"; exit 0; fi
    if [[ "$code" == "000" || "$code" =~ ^5 ]] && [[ $attempt -lt $max ]]; then
        sleep "$delay"; delay=$((delay*2)); continue
    fi
    printf '[%s] agendar %s -> HTTP %s body=%s\n' "$(date +%FT%T)" "$ACTION" "$code" "$payload" >> "$LOG_DIR/agendar.log"
    echo "${payload:-{\"ok\":false,\"error\":\"http_${code}\"}}"; exit 1
done
