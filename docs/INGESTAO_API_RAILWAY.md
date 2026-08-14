# API de Ingestão — Contrato para Railway

> Documento de referência para implementar o serviço de ingestão de relatórios no Railway. O frontend envia arquivos para este endpoint; o backend processa e grava no Supabase.

---

## 1. Endpoint de Upload

### `POST /api/ingest`

Envia um arquivo de relatório para processamento.

**Headers:**
```
Authorization: Bearer <access_token da sessão Supabase>
Content-Type: multipart/form-data
```

O endpoint é **autenticado**. A API valida o JWT com `auth.getUser()` e, num client
com a anon key no contexto do chamador, confere o escopo pelas mesmas funções que
governam o SELECT no Postgres (migrations `048`/`049`): admin global passa em tudo;
os demais precisam alcançar **o distribuidor E o fornecedor** do par enviado.

Sem isso o endpoint seria escrita anônima em produção — a API grava com
`service_role`, que passa por cima de todo o RLS.

### Modos de autenticação (migration `073`)

| Modo | Credencial | Quem usa | Escopo |
|------|-----------|----------|--------|
| **Sessão** | `Authorization: Bearer <access_token>` | Frontend (KAM/admin) | Funções de escopo do Postgres (o "E" do KAM) |
| **Token de serviço** | `Authorization: Bearer sk_…` | Canal 3 — API direta do ERP/distribuidor | Fixo a UM par `(distribuidor, fornecedor)` da chave; o corpo precisa casar |
| **Interno** | `x-ingest-internal-secret: <INGEST_INTERNAL_SECRET>` | Canal 1 — Edge Function `ingest-inbound-cloudmailin` | O par do corpo precisa ter config de recebimento ativa (`alwayson_distribuidor_recebimento`) |

Tokens de serviço: só o **hash sha256** vive no banco (`alwayson_distribuidor_service_tokens`); o texto puro sai **uma única vez** em `fn_alwayson_service_token_criar` (admin). O segredo interno é compartilhado entre a Edge Function e esta API — nunca passa pelo browser.

**Body (form-data):**
| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|------------|
| `file` | File | ✅ | Arquivo Excel (.xlsx, .xls) ou CSV (.csv) |
| `tipo` | string | ✅ | `vendas` \| `estoque` \| `clientes` |
| `distribuidor_id` | string (UUID) | ✅ | ID do distribuidor no Supabase |
| `fornecedor_id` | string (UUID) | ✅ | Tenant do fornecedor (`alwayson_tenants.tipo = 'fornecedor'`). Todo arquivo é o recorte de **um fornecedor dentro de um distribuidor** — ver migration `047` |
| `periodo_referencia` | string (YYYY-MM-DD) | ✅ | Data de referência do período do relatório |

**Exemplo (curl):**
```bash
curl -X POST "https://alwayson-ingest-api-production.up.railway.app/api/ingest" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -F "file=@relatorio_vendas_marco.xlsx" \
  -F "tipo=vendas" \
  -F "distribuidor_id=uuid-do-distribuidor" \
  -F "fornecedor_id=uuid-do-tenant-fornecedor" \
  -F "periodo_referencia=2026-03-01"
```

---

## 2. Respostas

### 202 Accepted (sucesso — processamento assíncrono)
```json
{
  "id": "uuid-do-registro-ingestao",
  "status": "pendente",
  "message": "Arquivo recebido. Processamento iniciado."
}
```

### 200 OK (sucesso — processamento síncrono)
```json
{
  "id": "uuid-do-registro-ingestao",
  "status": "concluido",
  "registros_processados": 1250,
  "message": "Processamento concluído com sucesso."
}
```

### 400 Bad Request (erro de validação)
```json
{
  "error": "tipo_invalido",
  "message": "Tipo deve ser vendas, estoque ou clientes."
}
```

### 401 Unauthorized (sem token ou sessão expirada)
```json
{
  "error": "sessao_invalida",
  "message": "Sessão inválida ou expirada. Entre novamente e repita o envio."
}
```

### 403 Forbidden (fora do escopo do utilizador)
```json
{
  "error": "sem_acesso",
  "message": "Você não tem acesso a este distribuidor/fornecedor."
}
```

Mesma resposta para "não alcança" e "par inexistente" — de propósito, para que
não se descubram pares válidos por tentativa.

### 422 Unprocessable Entity (erro no arquivo)
```json
{
  "error": "formato_invalido",
  "message": "Colunas obrigatórias ausentes: data_venda, cnpj_cliente",
  "erros": ["Linha 5: data_venda inválida", "Linha 12: cnpj_cliente vazio"]
}
```

### 500 Internal Server Error
```json
{
  "error": "internal_error",
  "message": "Erro ao processar arquivo."
}
```

---

## 3. Layout dos Relatórios (templates Campestre)

### 3.1 Relatório de Vendas (`tipo: vendas`)

| Coluna | Tipo | Obrigatório | Descrição |
|--------|------|-------------|-----------|
| `data_venda` | DATE (dd/mm/aaaa) | ✅ | Data da venda / emissão (mapeia para `data_emissao` em `alwayson_faturamento`) |
| `numero_nf` | TEXT | ✅ | Número da nota fiscal; **mesmo valor em várias linhas** = vários itens da mesma NF |
| `cnpj_cliente` | TEXT (14 dígitos) | ✅ | CNPJ sem formatação |
| `razao_social` | TEXT | ✅ | Razão social (upsert em `alwayson_clientes_distribuidor.razao_social`) |
| `nome_cliente` | TEXT | ✅ | Nome fantasia / exibição (`nome_fantasia`); se o arquivo antigo só tiver um nome, repetir também em razão até enriquecer por BrasilAPI |
| `codigo_vendedor` | TEXT | ✅ | Código interno do vendedor no distribuidor |
| `nome_vendedor` | TEXT | ✅ | Nome do vendedor |
| `codigo_supervisor` | TEXT | ❌ | Código do supervisor (hierarquia) |
| `nome_supervisor` | TEXT | ❌ | Nome do supervisor |
| `codigo_gerente` | TEXT | ❌ | Código do gerente (hierarquia) |
| `nome_gerente` | TEXT | ❌ | Nome do gerente |
| `sku` | TEXT | ✅ | Código do produto Campestre |
| `descricao_produto` | TEXT | ✅ | Descrição |
| `quantidade` | DECIMAL | ✅ | Quantidade na unidade informada em `unidade` |
| `unidade` | TEXT | ✅ | UN, CX, KG, etc. (gravado em `alwayson_faturamento_itens.unidade`) |
| `valor_unitario` | DECIMAL | ✅ | Preço unitário de venda (coerente com a unidade do item) |
| `valor_total` | DECIMAL | ✅ | Valor total **da linha** (item) |

**Cabeçalho lógico da NF:** para um mesmo par `(distribuidor_id, numero_nf)`, todas as linhas devem repetir os mesmos valores de `data_venda`, `cnpj_cliente`, `razao_social`, `nome_cliente` e campos de hierarquia (`codigo_*` / `nome_*`). Se houver divergência → rejeitar o arquivo (ou a NF) com erro de validação.

**Compatibilidade:** arquivos legados só com `nome_cliente`: tratar esse valor como fallback para `razao_social` e `nome_fantasia` no upsert até haver arquivo completo ou enriquecimento por CNPJ.

**`valor_total` do documento (`alwayson_faturamento.valor_total`):** não copiar de coluna “de cabeçalho” no Excel; **calcular** como soma dos `valor_total` das linhas-itens agrupadas na mesma NF (após validar consistência).

O serviço deve agrupar linhas por `(distribuidor_id, numero_nf)` para montar um registro em `alwayson_faturamento` e linhas em `alwayson_faturamento_itens`; códigos/nomes de hierarquia alimentam resolução ou upsert em `alwayson_vendedores_distribuidor` (ver [dívida / normatização](ingestao-normatizacao-divida-tecnica.md)).

Dados de upload são sempre escopados ao `distribuidor_id` informado no `POST` (incluindo unicidade de `numero_nf` e resolução de códigos).

### 3.2 Relatório de Estoque (`tipo: estoque`)

| Coluna | Tipo | Obrigatório | Descrição |
|--------|------|-------------|-----------|
| `data_posicao` | DATE | ✅ | Data da posição de estoque |
| `sku` | TEXT | ✅ | Código do produto |
| `descricao` | TEXT | ✅ | Descrição do produto |
| `quantidade_estoque` | DECIMAL | ✅ | Quantidade em estoque |
| `unidade` | TEXT | ✅ | UN, CX, KG, etc. |

### 3.3 Relatório de Clientes (`tipo: clientes`)

Mesmas colunas do `template-clientes.xlsx`:

| Coluna | Tipo | Obrigatório | Descrição |
|--------|------|-------------|-----------|
| `cnpj` | TEXT (14 dígitos) | ✅ | CNPJ sem formatação |
| `razao_social` | TEXT | ✅ | Razão social |
| `nome_fantasia` | TEXT | ✅ | Nome fantasia |
| `cidade` | TEXT | ✅ | |
| `estado` | TEXT | ✅ | UF |
| `codigo_vendedor` | TEXT | ❌ | |
| `nome_vendedor` | TEXT | ❌ | |

---

## 4. Tabelas Supabase (destino dos dados)

O projeto usa prefixo `alwayson_*`. O serviço Railway deve gravar em:

| Tipo | Tabelas afetadas |
|------|------------------|
| `vendas` | `alwayson_faturamento`, `alwayson_faturamento_itens`, `alwayson_clientes_distribuidor`, `alwayson_vendedores_distribuidor` (e, se aplicável, `alwayson_performance_periodo` ou agregados) |
| `estoque` | `alwayson_estoque_distribuidor` |
| `clientes` | `alwayson_clientes_distribuidor` |

### Tabela de controle de ingestão

Registrar cada upload em `alwayson_relatorios_ingestao`. **Execute a migration** em `docs/migrations/001_relatorios_ingestao.sql` no Supabase antes de usar.

---

## 5. Fluxo recomendado

1. **Receber** arquivo + metadados
2. **Validar** tipo, distribuidor_id, periodo_referencia
3. **Inserir** registro em `alwayson_relatorios_ingestao` com status `pendente`
4. **Retornar** 202 com `id` do registro
5. **Processar** em background: parse do arquivo, upsert nas tabelas
6. **Atualizar** registro com status `concluido` ou `erro`, `registros_processados`, `erros`

O frontend pode fazer **polling** em `GET /api/ingest/:id` ou usar **Supabase Realtime** na tabela `alwayson_relatorios_ingestao` para acompanhar o status.

---

## 6. Endpoint de Status (opcional)

### `GET /api/ingest/:id`

Retorna o status de um processamento.

**Resposta 200:**
```json
{
  "id": "uuid",
  "distribuidor_id": "uuid",
  "tipo": "vendas",
  "arquivo_nome": "relatorio_marco.xlsx",
  "status": "concluido",
  "periodo_referencia": "2026-03-01",
  "registros_processados": 1250,
  "erros": null,
  "criado_em": "2026-03-12T10:00:00Z"
}
```

---

## 7. Implementação neste repositório

Serviço Node em `services/ingest-api/` (Express + multer + `xlsx`).

```bash
# Terminal 1 — API (porta 8787)
npm run ingest:api

# Terminal 2 — frontend (precisa de VITE_INGEST_API_URL=http://localhost:8787)
npm run dev
```

Dockerfile de deploy: `services/ingest-api/Dockerfile` (raiz do repo como contexto: `docker build -f services/ingest-api/Dockerfile .`).

## 8. Variáveis de ambiente

### Frontend (Vite)
Adicione ao `.env` / `.env.local`:
```
VITE_INGEST_API_URL=http://localhost:8787
# em produção (já configurada na Vercel):
# https://alwayson-ingest-api-production.up.railway.app
VITE_SUPABASE_URL=https://osukbalwykbqvoumddxz.supabase.co
VITE_SUPABASE_ANON_KEY=<anon do projeto osukbalwykbqvoumddxz>
```

Projeto Supabase deste repo: ref **`osukbalwykbqvoumddxz`** — ver [`docs/SUPABASE_PROJECT.md`](SUPABASE_PROJECT.md). Não usar outro projeto Supabase para este codebase.

### Railway / API (backend)

| Variável | Descrição |
|----------|-----------|
| `SUPABASE_URL` | URL do projeto Supabase (`https://osukbalwykbqvoumddxz.supabase.co` neste produto) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key **do mesmo** projeto `osukbalwykbqvoumddxz`. Escreve; nunca decide acesso |
| `SUPABASE_ANON_KEY` | Anon key do mesmo projeto. Usada só para validar o JWT do chamador e resolver `auth.uid()` nas funções de escopo. Localmente cai para `VITE_SUPABASE_ANON_KEY` |
| `PORT` | Default `8787` |
| `CORS_ORIGIN` | Opcional; default libera a origem do browser. CORS **não** é controle de acesso — quem protege é o JWT |
| `INGEST_INTERNAL_SECRET` | Segredo interno compartilhado com a Edge Function do inbound (Canal 1). Sem ele, o modo `internal` não aceita ninguém |

O serviço recusa a subir se faltar qualquer uma das três chaves.

---

## 9. Recebimento automático (Canal 1 — e-mail)

Fluxo: **ERP do distribuidor agenda envio → e-mail dedicado (`{distribuidor}.{cnpj_raiz_fornecedor}@alwayson.com.br`) → CloudMailin → Edge Function `ingest-inbound-cloudmailin` → `POST /api/ingest` (modo interno)**.

1. `alwayson_distribuidor_recebimento` guarda o endereço por par `(distribuidor, fornecedor)` com tipos esperados e modo validação — a Edge Function resolve o destinatário por ela.
2. A Edge Function confere o **Basic Auth** do CloudMailin, baixa/decodifica o anexo, guarda o bruto no bucket `ingest-inbox` e chama esta API com `x-ingest-internal-secret`.
3. O par do corpo precisa ter config de recebimento **ativa** — senão o canal é recusado.
4. O tipo do relatório é inferido do nome do arquivo/subject (restrito aos `tipos_esperados`); o período, de `YYYY-MM` presente no e-mail (fallback: mês corrente).

Passos operacionais (account CloudMailin + DNS de `alwayson.com.br` + cadastro do endereço + URL-alvo com Basic Auth) estão no `.env.example`.

---

*Documento atualizado em 11/08/2026. Referência: DISTRIBUIDOR_PLUS_REFERENCE.md.*
