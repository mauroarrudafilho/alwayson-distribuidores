# Pipeline PDV (Explorar) — Railway

> Serviço batch para popular `alwayson_pdv_*`. Separado da ingestão de relatórios e do deploy Vercel.

**Projeto Supabase:** `osukbalwykbqvoumddxz`

---

## 1. Visão

| Etapa | Endpoint | Tabela(s) | Estado |
|-------|----------|-----------|--------|
| 1 Receita | `POST /api/pdv/receita-universo` | `alwayson_pdv_universo` | Esboço funcional |
| 2 Score | `POST /api/pdv/score-modelo` | `alwayson_pdv_score` | Reservado |
| 3 CNEFE | `POST /api/pdv/geocode-cnefe` | colunas geo em universo | Reservado |
| 4 Cruzamento | `POST /api/pdv/cruzamento` | `alwayson_pdv_prioridade` | Reservado |
| 5 Cobertura | `POST /api/pdv/cobertura` | `alwayson_pdv_cobertura` | Reservado |
| 6 Google | `POST /api/pdv/google-sinal` | só `google_place_id` | Reservado + feature flag |

Auditoria: `alwayson_pdv_pipeline_execucoes` (migration `055`).

---

## 2. Variáveis de ambiente (Railway)

| Variável | Obrigatório | Descrição |
|----------|-------------|-----------|
| `SUPABASE_URL` | Sim | `https://osukbalwykbqvoumddxz.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Sim | Escrita nas tabelas `alwayson_pdv_*` |
| `PDV_PIPELINE_SECRET` | Sim | Segredo para `X-Pipeline-Secret` |
| `RECEITA_DATA_DIR` | Etapa 1 | Caminho do volume com CSVs extraídos |
| `PORT` | Não | Default `8788` |
| `CORS_ORIGIN` | Não | Default aberto |

---

## 3. Dados da Receita Federal

1. Baixar o pacote mensal em [Dados Abertos CNPJ](https://arquivos.receitafederal.gov.br/dados/cnpj/dados_abertos_cnpj/) (Estabelecimentos, Empresas, Simples).
2. Extrair no volume Railway (ou montar volume persistente / bucket).
3. Apontar `RECEITA_DATA_DIR` para a pasta com os `.CSV`.

**Medir volume antes de geocode:** rodar etapa 1 com `--dry-run` ou `dry_run: true` na API.

---

## 4. Endpoints

### `GET /health`

```json
{ "ok": true, "service": "alwayson-pdv-pipeline" }
```

### `POST /api/pdv/receita-universo`

Header: `X-Pipeline-Secret: <PDV_PIPELINE_SECRET>`

Body (JSON):

```json
{
  "uf": "PE",
  "data_dir": "/data/receita/2026-08",
  "limit": 0,
  "dry_run": false
}
```

Resposta `202`:

```json
{
  "id": "uuid-da-execucao",
  "status": "processando",
  "etapa": "receita_universo"
}
```

### `GET /api/pdv/jobs/:id`

Consulta status/resultado em `alwayson_pdv_pipeline_execucoes`.

---

## 5. Local

```bash
# API
npm run pdv:api

# CLI direta (sem HTTP)
npm run pdv:receita -- --uf PE --data-dir ./data/receita --dry-run
```

Exemplo curl:

```bash
curl -X POST "http://localhost:8788/api/pdv/receita-universo" \
  -H "Content-Type: application/json" \
  -H "X-Pipeline-Secret: $PDV_PIPELINE_SECRET" \
  -d '{"uf":"PE","dry_run":true}'
```

---

## 6. Deploy Docker

```bash
docker build -f services/pdv-pipeline/Dockerfile -t alwayson-pdv-pipeline .
docker run --env-file .env.local -p 8788:8788 -v /caminho/receita:/data/receita alwayson-pdv-pipeline
```

No Railway: novo serviço, mesmo padrão da ingest-api (`services/pdv-pipeline/Dockerfile`, contexto = raiz do repo).

---

## 7. Pré-requisitos SQL

Aplicar no Supabase canônico:

- `054_pdv_inteligencia_explorar.sql` — tabelas PDV
- `055_pdv_pipeline_execucoes.sql` — log de jobs

```bash
supabase db query --linked -f docs/migrations/055_pdv_pipeline_execucoes.sql
```

---

## 8. Ordem de implementação (spec v2)

1. Etapa 1 isolada — validar contagem por UF (**este esboço**)
2. Etapa 3 score — só atributos Receita, sem Google
3. Etapa 2 CNEFE — medir taxa numa cidade
4. Etapas 4–5 cruzamento + cobertura
5. Etapa 6 Google — só após jurídico + feature flag
6. Telas Explorar (app)
