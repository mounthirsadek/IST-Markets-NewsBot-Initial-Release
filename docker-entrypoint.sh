#!/bin/bash
set -e

# ── Write Firebase service account from env var ───────────────────
# In Coolify, add GOOGLE_SERVICE_ACCOUNT_JSON as an environment variable
# containing the full JSON content of your Firebase service account key.
if [ -n "$GOOGLE_SERVICE_ACCOUNT_JSON" ]; then
  echo "$GOOGLE_SERVICE_ACCOUNT_JSON" > /app/service-account.json
  echo "✅ service-account.json written from GOOGLE_SERVICE_ACCOUNT_JSON"
fi

# ── Start the Express server ──────────────────────────────────────
echo "🚀 Starting IST Markets NewsBot on port ${PORT:-3000}..."
exec npx tsx server.ts
