# Checklist: tabelas `alwayson_*` (Supabase)

Objetivo: validar que o projeto canônico (`osukbalwykbqvoumddxz`, ver `docs/SUPABASE_PROJECT.md`) expõe todas as tabelas que o app e o seed esperam, e que as migrations deste repositório foram aplicadas na ordem correta.

Marque `[ ]` → `[x]` no dashboard (Table Editor) ou após verificar com `\dt` / `information_schema`.

---

## 1. Pré-requisito: tabelas “base” (sem `CREATE` em `docs/migrations/`)

Estas tabelas são referenciadas por FKs nas migrations `001`–`002` e pelo `003_seed_dados_mock.sql`, mas **não** são criadas por scripts neste repo. Num projeto novo, é preciso criar ou importar o DDL a partir do schema já existente (ex.: projeto legado ou export do Supabase) **antes** de rodar `001`.

| Tabela | Uso principal | Observação |
|--------|-----------------|------------|
| `alwayson_distribuidores` | FK de quase tudo; `useDistribuidores`, KPIs | Obrigatória antes da migration `001` |
| `alwayson_clientes_distribuidor` | Clientes, faturamento, excelência | Obrigatória antes da `002` |
| `alwayson_vendedores_distribuidor` | Vendas, performance, faturamento | Obrigatória antes da `002` |
| `alwayson_estoque_distribuidor` | Estoque, KPIs | Alterada pela `002` |
| `alwayson_metas_distribuidor` | Metas, hierarquia, KPIs | Usada pelo app; sem `CREATE` nas migrations deste repo |
| `alwayson_performance_periodo` | Dashboard, ingestão, performance | Usada pelo app; sem `CREATE` nas migrations deste repo |
| `alwayson_excelencia_criterios` | `useClientesExcelencia.ts` | Ainda consultada pelo front; confirmar existência ou alinhar código ao modelo `excelencia_config` |

---

## 2. Tabelas criadas ou alteradas por `docs/migrations/`

Aplique **na ordem numérica** `001` → `011`. A `008` altera `alwayson_insights_nf`; depende da `007`. A `010` adiciona campos GA em insights. A `011` cria de-para produto global Insights.

| Migration | Tabela(s) | Ação |
|-----------|-----------|------|
| `001_relatorios_ingestao.sql` | `alwayson_relatorios_ingestao` | CREATE |
| `002_novas_tabelas.sql` | `alwayson_produtos`, `alwayson_faturamento`, `alwayson_faturamento_itens`, `alwayson_excelencia_config`, `alwayson_excelencia_clientes` | CREATE; ALTER em `alwayson_distribuidores`, `alwayson_estoque_distribuidor` |
| `003_seed_dados_mock.sql` | (várias) | Dados — só após schema base + 001 + 002 |
| `004_faturamento_itens_unidade.sql` | `alwayson_faturamento_itens` | ALTER (coluna `unidade`) |
| `005_vendedores_codigo_externo.sql` | `alwayson_vendedores_distribuidor` | ALTER |
| `006_clientes_geo.sql` | `alwayson_clientes_distribuidor` | ALTER (geo) |
| `007_insights.sql` | `alwayson_insights_uploads`, `alwayson_insights_nf`, `alwayson_insights_nf_itens` | CREATE + RLS |
| `008_insights_nf_razao_social.sql` | `alwayson_insights_nf` | ALTER |
| `009_distribuidor_produto_de_para.sql` | `alwayson_distribuidor_produto_de_para` | CREATE |
| `010_insights_nf_emp_codprod_perfil.sql` | `alwayson_insights_nf`, `alwayson_insights_nf_itens` | ALTER (GA) |
| `011_insights_produto_de_para.sql` | `alwayson_insights_produto_de_para` | CREATE (FK → produtos.sku) |

---

## 3. Matriz: tabela × migration × código

| Tabela | Migration no repo | Onde no app (referência) | OK |
|--------|-------------------|---------------------------|-----|
| `alwayson_distribuidores` | `002` (ALTER apenas) | `useDistribuidores`, `useRelatoriosIngestao`, `useDashboardKPIs` | [ ] |
| `alwayson_clientes_distribuidor` | `006` (ALTER) | `useClientesBusca`, `useClientesExcelencia`, `useDashboardKPIs`, `ClienteDetalhe` | [ ] |
| `alwayson_vendedores_distribuidor` | `005` (ALTER) | `usePerformanceHierarchy`, `useDistribuidorPerformance`, `ClienteDetalhe` | [ ] |
| `alwayson_estoque_distribuidor` | `002` (ALTER) | `useEstoque`, `useDashboardKPIs` | [ ] |
| `alwayson_produtos` | `002` | `useProdutos` | [ ] |
| `alwayson_faturamento` | `002` | `useFaturamento` | [ ] |
| `alwayson_faturamento_itens` | `002`, `004` | `useFaturamento`, `ClienteDetalhe` | [ ] |
| `alwayson_excelencia_config` | `002` | `useExcelenciaConfig` | [ ] |
| `alwayson_excelencia_clientes` | `002` | `useExcelenciaConfig` | [ ] |
| `alwayson_excelencia_criterios` | *(nenhuma neste repo)* | `useClientesExcelencia` | [ ] |
| `alwayson_relatorios_ingestao` | `001` | `useRelatoriosIngestao` | [ ] |
| `alwayson_metas_distribuidor` | *(nenhuma neste repo)* | `useMetas`, `usePerformanceHierarchy`, `useDashboardKPIs` | [ ] |
| `alwayson_performance_periodo` | *(nenhuma neste repo)* | `useDistribuidorPerformance`, `useDashboardKPIs`, `usePerformanceHierarchy`, `useRelatoriosIngestao` | [ ] |
| `alwayson_distribuidor_produto_de_para` | `009` | `useDistribuidorProdutoDePara`, admin de-para | [ ] |
| `alwayson_insights_uploads` | `007` | *(sem query no `src` ainda — API/ingest futuro)* | [ ] |
| `alwayson_insights_nf` | `007`, `008`, `010` | Idem | [ ] |
| `alwayson_insights_nf_itens` | `007`, `010` | Idem | [ ] |
| `alwayson_insights_produto_de_para` | `011` | `AdminInsightsDeParaProdutos`, `useInsightsProdutoDePara` | [ ] |

---

## 4. Conferência rápida com o código

Todas as chamadas `.from('alwayson_…')` no `src/` aparecem nos hooks/listagem acima. Não há uso direto de `alwayson_insights_*` no frontend neste momento; as tabelas existem para uploads de NF e integração com ingestão/API.

---

## 5. Migração de dados do projeto antigo

Se precisar migrar dados legados de outro ref, use export/insert só contra o projeto canônico **`osukbalwykbqvoumddxz`**. O ref `kgzybpelluftexrewyke` não deve receber novas migrations AlwaysOn; respeite na carga a ordem das FKs (`alwayson_distribuidores` → clientes/vendedores → faturamento → itens, etc.).
