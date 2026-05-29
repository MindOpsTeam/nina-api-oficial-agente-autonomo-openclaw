#!/usr/bin/env bash
# pesquisar.sh — pesquisa a empresa/site do lead via edge fn nina-enrich (Firecrawl)
# e enriquece a memória do contato. Invocado pela skill quando o lead cita a empresa.
# Auth: header x-nina-secret (NINA_TOOLS_SECRET) — MESMO padrão do agendar.sh/nina-tools.
# Uso: pesquisar.sh --contact <ID> --empresa "<nome ou URL>"
set -euo pipefail

ENV_FILE="${NINA_ENV_FILE:-$HOME/.nina-sdr/.env}"
[[ -f "$ENV_FILE" ]] && { set +u; source "$ENV_FILE"; set -u; }

CONTACT_ID=""; QUERY=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --contact|--contact-id) CONTACT_ID="$2"; shift 2;;
    --empresa|--url|--query) QUERY="$2"; shift 2;;
    *) echo "arg desconhecido: $1" >&2; exit 2;;
  esac
done

[[ -z "$CONTACT_ID" ]] && { echo '{"ok":false,"error":"missing_contact_id"}'; exit 2; }
[[ -z "$QUERY" ]]      && { echo '{"ok":false,"error":"missing_empresa"}'; exit 2; }
[[ -z "${PANEL_BASE_URL:-}" ]]    && { echo '{"ok":false,"error":"no_panel_base_url"}'; exit 1; }
[[ -z "${NINA_TOOLS_SECRET:-}" ]] && { echo '{"ok":false,"error":"no_nina_tools_secret"}'; exit 1; }

BODY=$(python3 - "$CONTACT_ID" "$QUERY" <<'PY'
import json, sys
_, contact, query = sys.argv
print(json.dumps({"contact_id": contact, "query": query}))
PY
)

RESP=$(curl -s -w $'\n%{http_code}' --max-time 90 -X POST "${PANEL_BASE_URL}/nina-enrich" \
  -H "Content-Type: application/json" -H "x-nina-secret: ${NINA_TOOLS_SECRET}" \
  -d "$BODY" 2>/dev/null || printf '\n000')
code=$(printf '%s' "$RESP" | tail -n1); payload=$(printf '%s' "$RESP" | sed '$d')
[[ "$code" =~ ^2 ]] && { echo "$payload"; exit 0; }
echo "${payload:-{\"ok\":false,\"error\":\"http_${code}\"}}"; exit 1
