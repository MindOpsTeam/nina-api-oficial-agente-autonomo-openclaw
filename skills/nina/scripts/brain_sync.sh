#!/usr/bin/env bash
# brain_sync.sh — Puxa o branch 'nina-brain' (Brain Build, T2) do repo do cliente
# e atualiza a PERSONA/CONHECIMENTO da skill (identity/soul/knowledge/prompts/SKILL.md)
# SEM tocar nos scripts operacionais. O OpenClaw hot-reloada os arquivos do workspace.
#
# Rodado pelo cron */2 e sob demanda (o botão "Sincronizar" da UI dispara um
# /hooks/agent pedindo sync, e a skill chama este script — ver SKILL.md).
#
# SEGURANÇA: o token (GITHUB_BRAIN_TOKEN) vive só no ~/.nina-sdr/.env (chmod 600);
# o fetch usa uma URL autenticada inline, então o token NÃO é persistido no
# .git/config (o remote fica sem token).
#
# PRESERVAÇÃO DOS SCRIPTS: o deploy copia tudo de skills/nina EXCETO scripts/.
# Assim nina_reply.sh/agendar.sh/heartbeat.sh/este script nunca são apagados nem
# sobrescritos pelo pull — independe de o nina-brain conter ou não os scripts.
set -uo pipefail

ENV_FILE="${NINA_ENV_FILE:-$HOME/.nina-sdr/.env}"
[[ -f "$ENV_FILE" ]] && { set +u; source "$ENV_FILE"; set -u; }

LOG_DIR="${NINA_LOG_DIR:-$HOME/.nina-sdr/logs}"; mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/brain_sync.log"
log() { echo "[$(date '+%F %T')] $*" >> "$LOG"; }

BRAIN_DIR="${BRAIN_DIR:-$HOME/.nina-sdr/brain}"
BRAIN_BRANCH="${BRAIN_BRANCH:-nina-brain}"
BRAIN_REPO="${BRAIN_REPO:-}"                       # URL tokenless (https://github.com/...git)
SKILL_DEST="${SKILL_DEST:-$HOME/.openclaw/workspace/skills/nina}"

[[ -z "$BRAIN_REPO" ]]        && { log "BRAIN_REPO ausente; skip"; exit 0; }
[[ -d "$BRAIN_DIR/.git" ]]    || { log "brain repo não inicializado ($BRAIN_DIR); skip"; exit 0; }

# URL autenticada só em memória (não escreve token no config).
AUTH_URL="$BRAIN_REPO"
[[ -n "${GITHUB_BRAIN_TOKEN:-}" ]] && AUTH_URL="${BRAIN_REPO/https:\/\//https://x-access-token:${GITHUB_BRAIN_TOKEN}@}"

# Fetch do branch nina-brain (se ainda não existir no remoto, sai sem quebrar).
if ! git -C "$BRAIN_DIR" fetch --depth 1 "$AUTH_URL" "$BRAIN_BRANCH" >>"$LOG" 2>&1; then
    log "fetch ${BRAIN_BRANCH} falhou (branch ausente ou auth) — mantém skill atual"; exit 0
fi
OLD=$(git -C "$BRAIN_DIR" rev-parse HEAD 2>/dev/null || echo none)
git -C "$BRAIN_DIR" reset --hard FETCH_HEAD >>"$LOG" 2>&1 || { log "reset --hard falhou"; exit 0; }
git -C "$BRAIN_DIR" sparse-checkout reapply >>"$LOG" 2>&1 || true
NEW=$(git -C "$BRAIN_DIR" rev-parse HEAD 2>/dev/null || echo none)

[[ "$OLD" == "$NEW" ]] && { log "brain sem mudanças (${NEW:0:8})"; exit 0; }

SRC="$BRAIN_DIR/skills/nina"
[[ -d "$SRC" ]] || { log "skills/nina ausente no brain (branch ${BRAIN_BRANCH})"; exit 0; }
mkdir -p "$SKILL_DEST"

# Deploy: substitui cada item EXCETO scripts/ (preserva os scripts operacionais).
for item in "$SRC"/*; do
    [[ -e "$item" ]] || continue
    base="$(basename "$item")"
    [[ "$base" == "scripts" ]] && continue
    rm -rf "$SKILL_DEST/$base"
    cp -r "$item" "$SKILL_DEST/$base"
done

log "brain atualizado: ${OLD:0:8} -> ${NEW:0:8} (persona/conhecimento sincronizados; scripts preservados)"
