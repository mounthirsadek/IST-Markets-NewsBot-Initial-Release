#!/bin/bash
set -e

# ── Write Google credentials from env var ─────────────────────────
# Supports both:
#   - service_account JSON (from Firebase Console)
#   - authorized_user JSON (from gcloud application-default login)
if [ -n "$GOOGLE_SERVICE_ACCOUNT_JSON" ]; then
  echo "$GOOGLE_SERVICE_ACCOUNT_JSON" > /app/credentials.json
  export GOOGLE_APPLICATION_CREDENTIALS=/app/credentials.json
  echo "✅ credentials.json written from GOOGLE_SERVICE_ACCOUNT_JSON"
fi

# ── Start the Express server ──────────────────────────────────────
echo "🚀 Starting IST Markets NewsBot on port ${PORT:-3000}..."
exec npx tsx server.ts
