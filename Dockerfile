# Bidtranslator — production image. Pure-JS deps (express, pdfkit) + built-in
# node:sqlite, so no native build step is needed. Works on Spaceship Starlight
# Hyperlift (Docker from GitHub), a VPS, or any container host.
FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

# Install only production deps first (better layer caching).
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# App source.
COPY server.js ./
COPY src ./src
COPY public ./public

# SQLite db + uploaded photos live here. Mount a persistent volume at this path
# in your host so data survives redeploys (set BT_DATA_DIR to override).
RUN mkdir -p /app/data
ENV BT_DATA_DIR=/app/data

# The platform injects PORT; the app reads PORT/BT_PORT (default 4000).
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=4s --start-period=5s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-4000}/api/health" >/dev/null 2>&1 || exit 1

CMD ["node", "server.js"]
