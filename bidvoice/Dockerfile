# BidVoice production image. No build step — vanilla PWA + node:sqlite.
FROM node:22-slim

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY . .

ENV PORT=8788
ENV BIDVOICE_DATA_DIR=/var/data
VOLUME /var/data
EXPOSE 8788

CMD ["node", "server/index.mjs"]
