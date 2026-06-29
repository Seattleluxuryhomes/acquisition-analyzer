#!/bin/bash
# SessionStart hook: install dependencies so tests, type-checks, and the apps
# work in Claude Code on the web. Synchronous + idempotent.
set -euo pipefail

# Only run in Claude Code on the web (remote) environments.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# Root app — Bidtranslator (Express + pdfkit, no build step).
echo "[session-start] Installing root dependencies…"
npm install

# Voice Button AI app — React + TypeScript + Vite.
echo "[session-start] Installing voice-button-ai dependencies…"
npm install --prefix voice-button-ai

echo "[session-start] Done."
