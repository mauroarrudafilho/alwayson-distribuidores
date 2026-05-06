# Ingestão — normatização e dívida técnica

Referência para admin, parser (Railway) e evolução do schema. Complementa `INGESTAO_API_RAILWAY.md`.

## Decisões já alinhadas

- **Série da NF / chave de 44 dígitos:** não necessárias no escopo atual.
- **Unidade no item (UN/CX):** coluna `unidade` no template de vendas e em `alwayson_faturamento_itens` (migration `004_faturamento_itens_unidade.sql`).
- **Código externo na hierarquia:** coluna `codigo_externo` em `alwayson_vendedores_distribuidor` (migration `005_vendedores_distribuidor_codigo_externo.sql`).
- **Consistência do “cabeçalho” por NF:** para o mesmo `(distribuidor_id, numero_nf)`, validar igualdade de `data_venda`, `cnpj_cliente`, `razao_social`, `nome_cliente` e campos de hierarquia; rejeitar divergências (arquivos sem coluna `razao_social` podem só preencher `nome_cliente` com fallback até normalizar).
- **Valor total da NF em `alwayson_faturamento`:** derivar **sempre** da soma dos `valor_total` das linhas daquela NF (não confiar em campo de total vindo do arquivo se existir no futuro).

## Escopo multi-tenant

- Todo processamento usa o **`distribuidor_id`** do `POST /api/ingest`.
- **`numero_nf`** é único por distribuidor (`UNIQUE(distribuidor_id, numero_nf)`), não globalmente — o mesmo número pode existir em outro distribuidor sem conflito.
- Códigos de vendedor/supervisor/gerente vindos do arquivo devem ser interpretados **no contexto desse distribuidor** (nunca cruzar distribuidores).

## Cadastro administrativo (dívida — UI + schema)

Objetivo: fluxo padrão e menos ambiguidade para o parser.

| Tema | Descrição |
|------|-----------|
| Hierarquia com código | **Schema:** migration `005_vendedores_distribuidor_codigo_externo.sql` — coluna `codigo_externo` + índice único parcial `(distribuidor_id, tipo, codigo_externo)` quando preenchido (evita conflito entre códigos de vendedor vs supervisor no mesmo tenant). Tipo `Vendedor` em `src/types/distribuidor.ts` inclui `codigo_externo?`. **Ainda em aberto:** telas admin (CRUD), upsert no parser alinhado a `tipo` + colunas de ingest, e regras de hierarquia (`supervisor_id`). |
| Produtos / SKU | Códigos que o distribuidor usa no ERP podem divergir do SKU indústria. **Schema:** `alwayson_distribuidor_produto_de_para` (migration `009_distribuidor_produto_de_para.sql`) — `codigo_cliente` → `sku_fornecedor` (sempre alinhado a `alwayson_produtos.sku`, ex. base `cadastrogeral_vinicolacampestre`). **UI:** Admin → De-para produtos, upload planilha com colunas `codigo_cliente` e `sku_fornecedor`. O parser (Railway) deve resolver o SKU antes de gravar itens de faturamento e metas. |
| Tipo de faturamento (CX vs UN) | A coluna `unidade` no item documenta a intenção; o cadastro pode definir regras (ex. conversão CX→UN) para relatórios mistos. **Dívida:** regras no cadastro e validação no parser. |

## Cuidados adicionais (banco e operação)

1. **Idempotência:** reenvio do mesmo arquivo ou da mesma NF — definir se reimportação **substitui** faturamento existente (delete+insert na mesma transação) ou é rejeitada; evitar duplicar linhas de item.
2. **Transação:** agrupar criação de `alwayson_faturamento` + todos os itens + atualização de `alwayson_relatorios_ingestao` em uma transação por lote ou por NF, conforme estratégia.
3. **Precisão monetária:** `numeric` no Postgres está adequado; validar arredondamento (ex. soma linhas vs total calculado) com tolerância mínima se houver imprecisão de ponto flutuante no Excel.
4. **RLS:** policies devem restringir leitura/escrita por `distribuidor_id` (ou claim do JWT), para que o “carimbo” de tenant no dado seja reforçado no banco, não só na aplicação.
5. **Concorrência:** dois uploads do mesmo distribuidor para a mesma NF — usar bloqueio ou regra de negação clara (constraint + tratamento de erro).
6. **Integridade referencial:** cliente e vendedor resolvidos para UUIDs existentes; falha de resolução → linha/ NF em erro com mensagem registrada.
7. **Auditoria:** manter vínculo do faturamento com `alwayson_relatorios_ingestao.id` se o schema evoluir (coluna opcional) para rastreabilidade.

## Enriquecimento geográfico de clientes (migration 006)

- Colunas adicionadas em `alwayson_clientes_distribuidor`: `endereco_logradouro`, `endereco_numero`, `endereco_bairro`, `endereco_cep`, `lat`, `lng`, `geo_enriquecido_em`.
- `cidade` e `estado` já existiam; as novas colunas complementam com detalhes e coordenadas.
- `geo_enriquecido_em IS NULL` = pendente de enriquecimento (índice `idx_clientes_dist_geo_pendente` apoia o job de batch).

### Fluxo de enriquecimento (Railway)

```
Ingestão de clientes (CNPJ)
  → GET https://brasilapi.com.br/api/cnpj/v2/:cnpj   (endereço fiscal + razão social)
  → Nominatim: GET /search?q=<logradouro+numero+cep>&format=json&limit=1
  → Grava lat, lng, endereço, geo_enriquecido_em = NOW()
  → Falha de geocodificação → lat/lng NULL, geo_enriquecido_em = NULL (reprocessa depois)
```

**Dívida — UI e evolução:**
- Mapa de carteira por vendedor (clientes como pins) no módulo Performance.
- Endereço de entrega opcional no template de clientes (campo extra para futuro).
- Re-enriquecimento automático (job periódico ou trigger por UPDATE em `cnpj`).

## Módulo Insights — sell-out territorial (migration 007)

Upload único pelo time Arruda. Mesmo template de vendas dos distribuidores → comparativo maçã com maçã.
CNPJ do cliente é a âncora de cruzamento entre insights e dados dos distribuidores.

### Tabelas

| Tabela | Papel |
|--------|-------|
| `alwayson_insights_uploads` | Controle do lote de upload (período, status, totais) |
| `alwayson_insights_nf` | Cabeçalho de NF desnormalizado (cliente, hierarquia, valor calculado) |
| `alwayson_insights_nf_itens` | Linhas de item por NF (SKU, qtd, unidade, valores) |

### Decisões de design

- **`cnpj_cliente` no parser de insights** — usar `parseInsightsCnpj` / `shouldExcludeInsightsRowCnpj` em `src/lib/insightsCnpj.ts`: **exatamente 14 dígitos**, sem linhas com CNPJ **0** ou só zeros (`00000000000000`); preferir célula **texto** no Excel para não perder dígitos com notação científica.
- **`cod_emp` / `nome_emp`** — gravados no cabeçalho da NF (migration `010`); vêm repetidos nas linhas do Excel; no agrupamento `(cnpj_cliente, numero_nf)` usar o valor da primeira linha e **avisar** se houver divergência entre linhas do mesmo grupo. Servem a **highlights comerciais futuros** por empresa emitente, não à chave territorial.
- **`perfil`** — por **item** (`alwayson_insights_nf_itens`), texto já **normatizado na origem** (ex. canal); manter para filtros e relatórios segmentados.
- **`codprod_fornecedor`** — por **item**; **sempre gravar o valor bruto** da extração. Para alinhar ao catálogo indústria (`alwayson_produtos.sku`): não sobrescrever a coluna `sku` do item no load — usar tabela **`alwayson_insights_produto_de_para`** (`codigo_origem` ← valor de `codprod_fornecedor` na ingestão, `sku_fornecedor` com FK ao produto) e cruzamentos em relatórios. Admin: rota **`/admin/de-para-insights-produtos`**. Template público `template-de-para-insights-produtos.xlsx` (abas `codigo_origem`, `sku_fornecedor`). Subir “tudo uma vez” refere-se a **persistir histórico íntegro**; enriquecimento de SKU é **derivado**, idempotente e revisável.
- **Sem `distribuidor_id` obrigatório** — visão territorial não está amarrada a um distribuidor.
- **Hierarquia desnormalizada** — `codigo_vendedor/supervisor/gerente` gravados como texto (sem FK), para analytics sem JOIN custoso e para aceitar dados históricos de representantes que não estão mais no sistema.
- **`valor_total` da NF = SUM dos itens** — calculado pelo parser, não lido do arquivo.
- **Unicidade:** `UNIQUE(upload_id, cnpj_cliente, numero_nf)` — previne duplicata dentro do lote; NFs de distribuidores diferentes com mesmo número não conflitam porque são batches separados.
- **Geo:** mesmo fluxo BrasilAPI + Nominatim da migration 006 — `geo_enriquecido_em IS NULL` = pendente.
- **RLS:** SELECT aberto para autenticados; INSERT/UPDATE apenas via `service_role` (parser Railway).

### Fluxo do parser (Railway) — Insights

```
POST /api/insights/ingest   (multipart: file + nome + periodo_inicio + periodo_fim)
  → Cria alwayson_insights_uploads (status: processando)
  → Para cada grupo de linhas com mesmo (cnpj_cliente, numero_nf):
      → **Descarta** grupos onde `shouldExcludeInsightsRowCnpj(cnpj_cliente)` (CNPJ 0, vazio ou ≠ 14 dígitos válidos — ver `src/lib/insightsCnpj.ts`).
      → Valida consistência do cabeçalho (data, cliente, hierarquia)
      → Enriquece cidade/geo via BrasilAPI + Nominatim (async, falha não bloqueia)
      → INSERT alwayson_insights_nf   (valor_total = SUM itens)
      → INSERT alwayson_insights_nf_itens
  → Atualiza alwayson_insights_uploads (status: concluido | erro, total_nfs, total_itens)
```

### Queries analíticas planejadas (front)

| Visão | Query base |
|-------|-----------|
| Por cidade | `GROUP BY cidade, estado` → faturamento, clientes distintos, SKUs, volume |
| Top clientes (cidade) | `GROUP BY cnpj_cliente ORDER BY SUM(valor_total) DESC` |
| Evolução histórica do cliente | `GROUP BY DATE_TRUNC('month', data_emissao)` para um CNPJ |
| Mix do cliente | `JOIN itens GROUP BY sku` → meses ativos, volume, faturamento |
| Ranking de SKUs | `GROUP BY sku ORDER BY SUM(quantidade) DESC` por cidade ou período |

### Cruzamento com Distribuidor+

```sql
-- Clientes em Insights que existem na carteira de algum distribuidor
SELECT i.cnpj_cliente, i.nome_cliente, c.distribuidor_id, c.vendedor_id
FROM alwayson_insights_nf i
JOIN alwayson_clientes_distribuidor c ON c.cnpj = i.cnpj_cliente;
```

### Dívida — UI

- Rota `/insights` com filtro de cidade/CNPJ e período.
- Cards: Faturamento total, Clientes únicos, NFs, Volume (litros/UN/CX).
- Tabela de cidades rankadas por faturamento.
- Drill-down por cidade → top clientes → histórico do cliente → mix de SKUs.
- Comparativo: cliente insights vs mesmo cliente no módulo Distribuidor+.

## Tipo TypeScript (frontend)

- `FaturamentoItem` em `src/types/faturamento.ts` — `unidade?: string`.
- `Vendedor` em `src/types/distribuidor.ts` — `codigo_externo?: string` (migration 005).
- `ClienteDistribuidor` em `src/types/distribuidor.ts` — campos geo (migration 006).
- `InsightsUpload`, `InsightsNf`, `InsightsNfItem` e shapes analíticos em `src/types/insights.ts` (migration 007).
