FROM node:22-alpine
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY services/ingest-api ./services/ingest-api

ENV PORT=8787
EXPOSE 8787
CMD ["node", "services/ingest-api/server.mjs"]
