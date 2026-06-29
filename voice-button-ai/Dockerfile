# Voice Button AI — production image (build the app, run the key-safe server).
# Build context is the voice-button-ai/ directory.
FROM node:22-slim

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . ./
RUN npm run build

ENV NODE_ENV=production
# Hosts inject PORT; the server reads PORT → VBAI_PORT → 8787.
EXPOSE 8787
CMD ["node", "server/index.mjs"]
