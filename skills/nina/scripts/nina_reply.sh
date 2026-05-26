#!/usr/bin/env bash
# nina_reply.sh — Entrega a resposta da Nina ao lead.
# POST {PANEL_BASE_URL}/nina-reply {conversation_id, run_id, content, status}
# (o app enfileira em send_queue e o whatsapp-sender entrega).
#
# Uso (a skill chama via exec):
#   nina_reply.sh --conversation <ID> [--run <RUN_ID>] [--status sent|error] --content "<texto>"
#   (se --content for omitido, lê o conteúdo do stdin)
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/_shared.sh"

CONVERSATION_ID=""; RUN_ID=""; STATUS="sent"; CONTENT=""
while [[ $# -gt 0 ]]; do
    case "$1" in
        --conversation|--conversation-id) CONVERSATION_ID="$2"; shift 2;;
        --run|--run-id)                   RUN_ID="$2"; shift 2;;
        --status)                         STATUS="$2"; shift 2;;
        --content)                        CONTENT="$2"; shift 2;;
        *) echo "arg desconhecido: $1" >&2; exit 2;;
    esac
done
[[ -z "$CONTENT" && ! -t 0 ]] && CONTENT="$(cat)"

[[ -z "$CONVERSATION_ID" ]] && { echo '{"error":"missing_conversation_id"}'; exit 2; }
[[ "$STATUS" != "error" ]] && STATUS="sent"

BODY=$(python3 - "$CONVERSATION_ID" "$RUN_ID" "$STATUS" "$CONTENT" <<'PY'
import json, sys
_, conv, run, status, content = sys.argv
print(json.dumps({
    "conversation_id": conv,
    "run_id": run or None,
    "content": content,
    "status": status,
}))
PY
)

RESP=$(_panel_post "nina-reply" "$BODY") || { echo "$RESP"; exit 1; }
echo "$RESP"
