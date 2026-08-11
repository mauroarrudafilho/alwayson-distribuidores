FROM node:22-alpine
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY services/ingest-api ./services/ingest-api
# resolve-cliente-cidade.mjs importa scripts/lib/insights-cnpj-geo.mjs — sem
# esta cópia o container sobe e morre em ERR_MODULE_NOT_FOUND.
COPY scripts/lib ./scripts/lib

ENV PORT=8787
EXPOSE 8787
CMD ["node", "services/ingest-api/server.mjs"]
