# API de Ingestão — Contrato para Railway

> Documento de referência para implementar o serviço de ingestão de relatórios no Railway. O frontend envia arquivos para este endpoint; o backend processa e grava no Supabase.

---

## 1. Endpoint de Upload

### `POST /api/ingest`

Envia um arquivo de relatório para processamento.

**Headers:**
```
Content-Type: multipart/form-data
```

**Body (form-data):**
| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|------------|
| `file` | File | ✅ | Arquivo Excel (.xlsx, .xls) ou CSV (.csv) |
| `tipo` | string | ✅ | `vendas` \| `estoque` \| `clientes` |
| `distribuidor_id` | string (UUID) | ✅ | ID do distribuidor no Supabase |
| `periodo_referencia` | string (YYYY-MM-DD) | ✅ | Data de referência do período do relatório |

**Exemplo (curl):**
```bash
curl -X POST "https://seu-servico.railway.app/api/ingest" \
  -F "file=@relatorio_vendas_marco.xlsx" \
  -F "tipo=vendas" \
  -F "distribuidor_id=uuid-do-distribuidor" \
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
| `data_venda` | DATE (dd/mm/aaaa) | ✅ | Data da venda |
| `cnpj_cliente` | TEXT (14 dígitos) | ✅ | CNPJ sem formatação |
| `nome_cliente` | TEXT | ✅ | Nome fantasia ou razão social |
| `codigo_vendedor` | TEXT | ✅ | Código interno do vendedor no distribuidor |
| `nome_vendedor` | TEXT | ✅ | Nome do vendedor |
| `sku` | TEXT | ✅ | Código do produto Campestre |
| `descricao_produto` | TEXT | ✅ | Descrição |
| `quantidade` | DECIMAL | ✅ | Quantidade vendida |
| `valor_unitario` | DECIMAL | ✅ | Preço unitário de venda |
| `valor_total` | DECIMAL | ✅ | Valor total do item |
| `codigo_supervisor` | TEXT | ❌ | Código do supervisor (se disponível) |

### 3.2 Relatório de Estoque (`tipo: estoque`)

| Coluna | Tipo | Obrigatório | Descrição |
|--------|------|-------------|-----------|
| `data_posicao` | DATE | ✅ | Data da posição de estoque |
| `sku` | TEXT | ✅ | Código do produto |
| `descricao` | TEXT | ✅ | Descrição do produto |
| `quantidade_estoque` | DECIMAL | ✅ | Quantidade em estoque |
| `unidade` | TEXT | ✅ | UN, CX, KG, etc. |

---

## 4. Tabelas Supabase (destino dos dados)

O projeto usa prefixo `alwayson_*`. O serviço Railway deve gravar em:

| Tipo | Tabelas afetadas |
|------|------------------|
| `vendas` | `alwayson_clientes_distribuidor`, `alwayson_vendedores_distribuidor`, `alwayson_performance_periodo` |
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

## 7. Variáveis de ambiente

### Frontend (Vite)
Adicione ao `.env`:
```
VITE_INGEST_API_URL=https://seu-servico.railway.app
```

### Railway (backend)

| Variável | Descrição |
|----------|-----------|
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (para inserir dados) |

---

*Documento gerado em 12/03/2026. Referência: DISTRIBUIDOR_PLUS_REFERENCE.md.*
