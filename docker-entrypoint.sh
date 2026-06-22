#!/bin/sh
# Starts the app, optionally with Litestream continuous backup of the SQLite DB
# to S3-compatible storage (Cloudflare R2, Backblaze B2, etc.). If the storage
# env vars aren't set, this runs the app exactly as before — so shipping it can
# never break a deploy that hasn't set up storage yet.
set -e
DB="${BT_DATA_DIR:-/app/data}/bidtranslator.db"

if [ -n "$LITESTREAM_BUCKET" ] && [ -n "$LITESTREAM_ACCESS_KEY_ID" ] && litestream version >/dev/null 2>&1; then
  echo "[litestream] configured — restoring latest backup if one exists…"
  litestream restore -if-db-not-exists -if-replica-exists "$DB" || echo "[litestream] no backup yet (fresh start)"
  echo "[litestream] replicating + launching app"
  exec litestream replicate -exec "node server.js"
else
  echo "[litestream] not configured — running app directly (data not backed up)"
  exec node server.js
fi
