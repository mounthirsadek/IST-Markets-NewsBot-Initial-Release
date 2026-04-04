# ── IST Markets NewsBot ──────────────────────────────────────────
# Single-stage build: installs all deps (tsx + vite needed at runtime),
# builds the Vite frontend, then serves via Express in production mode.
# ─────────────────────────────────────────────────────────────────

FROM node:20-alpine

# Install bash + ca-certificates
RUN apk add --no-cache bash ca-certificates

WORKDIR /app

# Copy package files first (layer cache)
COPY package*.json ./

# Install ALL dependencies (tsx + vite are imported by server.ts at runtime)
RUN npm ci

# Copy full source
COPY . .

# Build Vite frontend → /app/dist
RUN npm run build

# Entrypoint script
COPY docker-entrypoint.sh ./
RUN chmod +x /app/docker-entrypoint.sh

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
