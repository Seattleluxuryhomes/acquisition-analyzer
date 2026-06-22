# Bidtranslator — production image. Pure-JS deps (express, pdfkit) + built-in
# node:sqlite, so no native build step is needed. Works on Spaceship Starlight
# Hyperlift (Docker from GitHub), a VPS, or any container host.
FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

# Install only production deps first (better layer caching).
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Litestream: continuous SQLite backup to S3-compatible storage so data survives
# redeploys/restarts even with no persistent volume. Dormant unless LITESTREAM_*
# env vars are set (see docker-entrypoint.sh), so this never affects a deploy
# that hasn't configured storage.
ARG LITESTREAM_VERSION=0.3.13
RUN set -eux; \
    case "$(uname -m)" in x86_64) A=amd64 ;; aarch64) A=arm64 ;; *) A=amd64 ;; esac; \
    wget -qO /tmp/ls.tar.gz "https://github.com/benbjohnson/litestream/releases/download/v${LITESTREAM_VERSION}/litestream-v${LITESTREAM_VERSION}-linux-${A}.tar.gz"; \
    tar -C /usr/local/bin -xzf /tmp/ls.tar.gz; \
    rm /tmp/ls.tar.gz; \
    litestream version

# App source.
COPY server.js ./
COPY src ./src
COPY public ./public
COPY litestream.yml /etc/litestream.yml
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# SQLite db + uploaded photos live here. With Litestream configured, the db is
# backed up off-box; otherwise mount a persistent volume here.
RUN mkdir -p /app/data
ENV BT_DATA_DIR=/app/data

# The platform injects PORT; the app reads PORT/BT_PORT (default 4000).
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=4s --start-period=5s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-4000}/api/health" >/dev/null 2>&1 || exit 1

CMD ["/usr/local/bin/docker-entrypoint.sh"]
