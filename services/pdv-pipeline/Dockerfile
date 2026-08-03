FROM node:22-alpine
WORKDIR /app

# unzip para extrair ZIPs da Receita no volume de dados (opcional)
RUN apk add --no-cache unzip

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY services/pdv-pipeline ./services/pdv-pipeline

ENV PORT=8788
EXPOSE 8788
CMD ["node", "services/pdv-pipeline/server.mjs"]
