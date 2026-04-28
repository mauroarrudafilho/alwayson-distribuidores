# Insights Conectado + Roadmap (Ponte Performance · Histórico CNPJ) — Plano de Execução

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Conectar a aba Insights ao Supabase (substituindo todos os mocks), adicionar a aba Produtos no Insights, e estabelecer roadmap das Fases 2 (Ponte Performance) e 3 (Histórico de CNPJ) que terão planos próprios quando iniciarem.

**Architecture:** Frontend lê de `alwayson_insights_nf` + `alwayson_insights_nf_itens` via hooks React Query. Agregações pesadas vivem em **views/RPCs no Postgres** (não no front), tirando carga do cliente e permitindo filtros server-side. Upload de XLSX para Insights segue o mesmo padrão da ingestão atual: front envia para o serviço Railway (`POST /api/ingest`), que parseia e grava com `service_role` (bypass RLS). RLS de `SELECT` libera para todos os autenticados; `INSERT/UPDATE/DELETE` só via service_role.

**Tech Stack:** Vite + React 19 + TypeScript · Supabase (Postgres + Auth + RLS) · TanStack React Query · Tailwind 4 + shadcn/ui · Recharts · Railway (parser, repo separado).

---

## Convenções deste plano

- **Sem TDD strict.** O repo não tem vitest/jest. Verificação é via `npm run dev` + browser + queries diretas no Supabase. Cada tarefa lista o critério "como saber que funcionou".
- **Commits pequenos e frequentes.** Cada tarefa termina com um commit isolado.
- **Migrations seguem a numeração sequencial existente** (`docs/migrations/008_*.sql`, `009_*.sql`...). Aplicar manualmente no Supabase via SQL Editor — o repo não tem CLI de migration.
- **Branch única para Fase 0+1**: `feat/insights-conectado`. Fases 2 e 3 ganham branches próprias.
- **Parser de XLSX é trabalho separado** no repo Railway (`alwayson-ingestao-api`), fora do escopo deste plano. Aqui só especificamos o contrato.

---

## Visão Geral das Fases

| Fase | Entregável | Bloqueia | Detalhe neste doc |
|------|-----------|----------|-------------------|
| 0 | Policies RLS de Insights completas + auditoria multi-distribuidor | 1 | ✅ Detalhado |
| 1 | Insights lendo do banco + aba Produtos + UI de upload Insights | 2, 3 | ✅ Detalhado |
| 2 | Ponte Performance → Insights (badge informativo + popover) | — | 📋 Roadmap |
| 3 | Histórico de CNPJ (tabela, view, UI no Cliente, auditoria Admin) | — | 📋 Roadmap |

---

## Estrutura de arquivos (Fase 0+1)

**Criar:**
- `docs/migrations/008_insights_rls_policies.sql` — policies de RLS faltando
- `docs/migrations/009_insights_views.sql` — views agregadas (cidades, top clientes, mix, produtos)
- `src/hooks/useInsightsCidades.ts` — substitui `MOCK_CIDADES`
- `src/hooks/useInsightsTopClientes.ts` — substitui `MOCK_TOP_CLIENTES`
- `src/hooks/useInsightsClienteHistorico.ts` — substitui `MOCK_CLIENTE_HISTORICO`
- `src/hooks/useInsightsClienteMix.ts` — substitui `MOCK_CLIENTE_MIX`
- `src/hooks/useInsightsProdutos.ts` — novo (aba Produtos)
- `src/hooks/useInsightsKpisGerais.ts` — KPIs do header
- `src/components/insights/InsightsAbaProdutos.tsx` — UI da nova aba
- `src/components/insights/InsightsUploadDialog.tsx` — UI de upload (admin)
- `src/pages/AdminInsights.tsx` — sub-aba do Admin para gerenciar uploads de Insights

**Modificar:**
- `src/pages/InsightsPanel.tsx` — remover imports de mock, usar hooks reais, adicionar tabs (Territórios | Clientes | Produtos)
- `src/App.tsx` — adicionar rota `/admin/insights`
- `src/pages/Admin.tsx` — adicionar link para sub-aba Insights
- `docs/INGESTAO_API_RAILWAY.md` — adicionar seção do endpoint de Insights

**Deletar:**
- `src/hooks/useMockInsights.ts` — só após confirmar que nada mais importa dele

---

## Fase 0 — Pré-requisitos (RLS)

### Tarefa 0.1: Auditoria das policies RLS atuais

**Files:** apenas leitura, sem mudanças

- [ ] **Step 1: Listar todas as policies ativas no Supabase**

No SQL Editor do Supabase:

```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename LIKE 'alwayson_%'
ORDER BY tablename, policyname;
```

Salvar resultado em `docs/superpowers/plans/_artifacts/2026-04-27-rls-snapshot.md` (criar a pasta `_artifacts` se não existir).

- [ ] **Step 2: Identificar tabelas sem isolamento por distribuidor**

Para cada tabela com coluna `distribuidor_id`, conferir se há policy que filtra por `distribuidor_id = auth.jwt() ->> 'distribuidor_id'` ou equivalente. Listar gaps em `docs/superpowers/plans/_artifacts/2026-04-27-rls-gaps.md` com nível: bloqueante / não-bloqueante.

- [ ] **Step 3: Decisão de escopo**

Se houver gaps **bloqueantes** (tabelas sensíveis sem isolamento), criar tarefa 0.1.bis para corrigi-los antes de seguir. Se forem só não-bloqueantes (ex: relatórios de erro), anotar como dívida e seguir. Documentar a decisão no artifact.

**Critério de aceite:** Os dois artifacts existem e a decisão de escopo está clara.

---

### Tarefa 0.2: Migration 008 — policies de RLS de Insights

**Files:**
- Create: `docs/migrations/008_insights_rls_policies.sql`

- [ ] **Step 1: Escrever a migration**

```sql
-- Migration 008 — Policies de RLS para o módulo Insights.
-- SELECT: qualquer autenticado (Insights é visível por todo o time).
-- INSERT/UPDATE/DELETE: apenas via service_role (parser Railway).

-- ─── alwayson_insights_uploads ──────────────────────────────────────────────

DROP POLICY IF EXISTS insights_uploads_select_auth ON alwayson_insights_uploads;
CREATE POLICY insights_uploads_select_auth
  ON alwayson_insights_uploads
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT/UPDATE/DELETE deliberadamente sem policy → bloqueado para anon/authenticated.
-- service_role bypassa RLS automaticamente.

-- ─── alwayson_insights_nf ───────────────────────────────────────────────────

DROP POLICY IF EXISTS insights_nf_select_auth ON alwayson_insights_nf;
CREATE POLICY insights_nf_select_auth
  ON alwayson_insights_nf
  FOR SELECT
  TO authenticated
  USING (true);

-- ─── alwayson_insights_nf_itens ─────────────────────────────────────────────

DROP POLICY IF EXISTS insights_nf_itens_select_auth ON alwayson_insights_nf_itens;
CREATE POLICY insights_nf_itens_select_auth
  ON alwayson_insights_nf_itens
  FOR SELECT
  TO authenticated
  USING (true);
```

- [ ] **Step 2: Aplicar no Supabase (SQL Editor)**

Executar o conteúdo do arquivo no SQL Editor do projeto Supabase. Confirmar que rodou sem erro.

- [ ] **Step 3: Smoke test de leitura como usuário autenticado**

No SQL Editor, com role `authenticated` (Settings → SQL Editor → role selector):

```sql
SELECT count(*) FROM alwayson_insights_uploads;
SELECT count(*) FROM alwayson_insights_nf;
SELECT count(*) FROM alwayson_insights_nf_itens;
```

Esperado: retorna 0 (tabelas vazias) sem erro de permissão. Se der `permission denied`, a policy não pegou.

- [ ] **Step 4: Smoke test de bloqueio de INSERT**

Como `authenticated`:

```sql
INSERT INTO alwayson_insights_uploads (nome, periodo_inicio, periodo_fim, arquivo_nome)
VALUES ('teste', '2026-01-01', '2026-01-31', 'teste.xlsx');
```

Esperado: erro `new row violates row-level security policy`. Se inserir, há policy de INSERT escondida — investigar.

- [ ] **Step 5: Commit**

```bash
git add docs/migrations/008_insights_rls_policies.sql
git commit -m "feat(insights): add RLS policies for read-only access"
```

**Critério de aceite:** authenticated lê tudo, não escreve nada. service_role escreve normalmente.

---

## Fase 1 — Insights conectado ao banco + aba Produtos

### Tarefa 1.1: Migration 009 — views agregadas

Agregações no banco (não no front) para reduzir tráfego e permitir filtros eficientes.

**Files:**
- Create: `docs/migrations/009_insights_views.sql`

- [ ] **Step 1: Escrever a view de cidades**

```sql
-- Migration 009 — Views agregadas do Insights.
-- Reaproveitamento entre tabela territorial, top clientes e drilldowns.

-- ─── View: alwayson_insights_v_cidades ──────────────────────────────────────

CREATE OR REPLACE VIEW alwayson_insights_v_cidades AS
SELECT
  COALESCE(nf.cidade, '— sem cidade —')   AS cidade,
  COALESCE(nf.estado, '—')                AS estado,
  SUM(nf.valor_total)                     AS faturamento_total,
  COUNT(DISTINCT nf.id)                   AS total_nfs,
  COUNT(DISTINCT nf.cnpj_cliente)         AS total_clientes,
  CASE
    WHEN COUNT(DISTINCT nf.cnpj_cliente) > 0
    THEN SUM(nf.valor_total) / COUNT(DISTINCT nf.cnpj_cliente)
    ELSE 0
  END                                     AS ticket_medio_cliente,
  COUNT(DISTINCT itens.sku)               AS total_skus,
  SUM(itens.quantidade)                   AS quantidade_total
FROM alwayson_insights_nf nf
LEFT JOIN alwayson_insights_nf_itens itens ON itens.nf_id = nf.id
GROUP BY nf.cidade, nf.estado;

COMMENT ON VIEW alwayson_insights_v_cidades IS
  'Visão territorial agregada por cidade/estado para a aba Insights.';
```

- [ ] **Step 2: Escrever a view de top clientes**

```sql
-- ─── View: alwayson_insights_v_clientes ─────────────────────────────────────

CREATE OR REPLACE VIEW alwayson_insights_v_clientes AS
SELECT
  nf.cnpj_cliente,
  MAX(nf.nome_cliente)            AS nome_cliente,
  MAX(nf.cidade)                  AS cidade,
  MAX(nf.estado)                  AS estado,
  SUM(nf.valor_total)             AS faturamento_total,
  COUNT(DISTINCT nf.id)           AS total_nfs,
  MAX(nf.data_emissao)            AS ultima_compra,
  COUNT(DISTINCT itens.sku)       AS total_skus
FROM alwayson_insights_nf nf
LEFT JOIN alwayson_insights_nf_itens itens ON itens.nf_id = nf.id
GROUP BY nf.cnpj_cliente;

COMMENT ON VIEW alwayson_insights_v_clientes IS
  'Resumo por cliente (CNPJ) — base para listagens e ranking.';
```

- [ ] **Step 3: Escrever a view de produtos (aba Produtos)**

```sql
-- ─── View: alwayson_insights_v_produtos ─────────────────────────────────────

CREATE OR REPLACE VIEW alwayson_insights_v_produtos AS
SELECT
  itens.sku,
  COALESCE(p.descricao, MAX(itens.descricao))  AS descricao,
  p.categoria                                  AS categoria,
  SUM(itens.valor_total)                       AS faturamento_total,
  SUM(itens.quantidade)                        AS quantidade_total,
  MAX(itens.unidade)                           AS unidade,
  COUNT(DISTINCT nf.id)                        AS total_nfs,
  COUNT(DISTINCT nf.cnpj_cliente)              AS total_clientes,
  COUNT(DISTINCT (nf.cidade || '|' || nf.estado)) AS total_cidades,
  MIN(nf.data_emissao)                         AS primeira_venda,
  MAX(nf.data_emissao)                         AS ultima_venda
FROM alwayson_insights_nf_itens itens
JOIN alwayson_insights_nf nf ON nf.id = itens.nf_id
LEFT JOIN alwayson_produtos p ON p.sku = itens.sku
GROUP BY itens.sku, p.descricao, p.categoria;

COMMENT ON VIEW alwayson_insights_v_produtos IS
  'Visão por SKU para aba Produtos. Categoria vem de alwayson_produtos quando catalogado.';
```

- [ ] **Step 4: Escrever a view de histórico mensal por cliente**

```sql
-- ─── View: alwayson_insights_v_cliente_mes ──────────────────────────────────

CREATE OR REPLACE VIEW alwayson_insights_v_cliente_mes AS
SELECT
  nf.cnpj_cliente,
  to_char(nf.data_emissao, 'YYYY-MM') AS ano_mes,
  SUM(nf.valor_total)                 AS faturamento,
  COUNT(DISTINCT nf.id)               AS total_nfs,
  COUNT(DISTINCT itens.sku)           AS total_skus,
  SUM(itens.quantidade)               AS quantidade_total
FROM alwayson_insights_nf nf
LEFT JOIN alwayson_insights_nf_itens itens ON itens.nf_id = nf.id
GROUP BY nf.cnpj_cliente, to_char(nf.data_emissao, 'YYYY-MM');
```

- [ ] **Step 5: Escrever a view de mix por cliente**

```sql
-- ─── View: alwayson_insights_v_cliente_mix ──────────────────────────────────

CREATE OR REPLACE VIEW alwayson_insights_v_cliente_mix AS
SELECT
  nf.cnpj_cliente,
  itens.sku,
  COALESCE(p.descricao, MAX(itens.descricao))  AS descricao,
  COUNT(DISTINCT to_char(nf.data_emissao, 'YYYY-MM')) AS meses_ativos,
  SUM(itens.quantidade)                              AS quantidade_total,
  MAX(itens.unidade)                                 AS unidade,
  SUM(itens.valor_total)                             AS faturamento_total,
  MIN(nf.data_emissao)                               AS primeira_compra,
  MAX(nf.data_emissao)                               AS ultima_compra
FROM alwayson_insights_nf_itens itens
JOIN alwayson_insights_nf nf ON nf.id = itens.nf_id
LEFT JOIN alwayson_produtos p ON p.sku = itens.sku
GROUP BY nf.cnpj_cliente, itens.sku, p.descricao;
```

- [ ] **Step 6: Aplicar no Supabase**

Executar o arquivo completo no SQL Editor. Verificar com:

```sql
SELECT * FROM alwayson_insights_v_cidades LIMIT 1;
SELECT * FROM alwayson_insights_v_clientes LIMIT 1;
SELECT * FROM alwayson_insights_v_produtos LIMIT 1;
SELECT * FROM alwayson_insights_v_cliente_mes LIMIT 1;
SELECT * FROM alwayson_insights_v_cliente_mix LIMIT 1;
```

Esperado: 0 rows mas sem erro (tabelas-base vazias). Se der erro de coluna, ajustar nomes.

- [ ] **Step 7: Commit**

```bash
git add docs/migrations/009_insights_views.sql
git commit -m "feat(insights): add aggregated views for dashboard queries"
```

**Critério de aceite:** As 5 views existem e podem ser consultadas como `authenticated` (herdam policies das tabelas-base via `security_invoker` default em PG 15+; se não, ajustar com `WITH (security_invoker=true)`).

---

### Tarefa 1.2: Hook `useInsightsKpisGerais`

**Files:**
- Create: `src/hooks/useInsightsKpisGerais.ts`

- [ ] **Step 1: Implementar o hook**

```typescript
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface InsightsKpisGerais {
  faturamento_total: number
  total_cidades: number
  total_clientes: number
  total_nfs: number
  total_skus: number
}

export function useInsightsKpisGerais() {
  return useQuery({
    queryKey: ['insights', 'kpis-gerais'],
    queryFn: async (): Promise<InsightsKpisGerais> => {
      const { data, error } = await supabase
        .from('alwayson_insights_v_cidades')
        .select('faturamento_total, total_clientes, total_nfs, total_skus, cidade')

      if (error) throw error

      return {
        faturamento_total: data.reduce((s, r) => s + Number(r.faturamento_total ?? 0), 0),
        total_cidades: data.length,
        total_clientes: data.reduce((s, r) => s + Number(r.total_clientes ?? 0), 0),
        total_nfs: data.reduce((s, r) => s + Number(r.total_nfs ?? 0), 0),
        total_skus: Math.max(...data.map(r => Number(r.total_skus ?? 0)), 0),
      }
    },
    staleTime: 60_000,
  })
}
```

- [ ] **Step 2: Verificar via dev server**

Adicionar temporariamente no `InsightsPanel.tsx`:

```typescript
const { data: kpis } = useInsightsKpisGerais()
console.log('KPIs reais:', kpis)
```

Rodar `npm run dev`, abrir `/insights`, verificar console. Sem dados ainda (banco vazio) deve retornar zeros sem erros.

- [ ] **Step 3: Reverter o console.log e commit**

```bash
git add src/hooks/useInsightsKpisGerais.ts
git commit -m "feat(insights): add hook for header KPIs"
```

---

### Tarefa 1.3: Hook `useInsightsCidades`

**Files:**
- Create: `src/hooks/useInsightsCidades.ts`

- [ ] **Step 1: Implementar**

```typescript
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { InsightsCidadeRow } from '@/types/insights'

interface UseInsightsCidadesOptions {
  estado?: string
  busca?: string
}

export function useInsightsCidades({ estado, busca }: UseInsightsCidadesOptions = {}) {
  return useQuery({
    queryKey: ['insights', 'cidades', { estado, busca }],
    queryFn: async (): Promise<InsightsCidadeRow[]> => {
      let q = supabase
        .from('alwayson_insights_v_cidades')
        .select('*')
        .order('faturamento_total', { ascending: false })

      if (estado) q = q.eq('estado', estado)
      if (busca) q = q.ilike('cidade', `%${busca}%`)

      const { data, error } = await q
      if (error) throw error
      return data as InsightsCidadeRow[]
    },
    staleTime: 60_000,
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useInsightsCidades.ts
git commit -m "feat(insights): add hook for territorial view"
```

---

### Tarefa 1.4: Hook `useInsightsTopClientes`

**Files:**
- Create: `src/hooks/useInsightsTopClientes.ts`

- [ ] **Step 1: Implementar**

```typescript
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { InsightsTopCliente } from '@/types/insights'

interface UseInsightsTopClientesOptions {
  cidade?: string
  estado?: string
  busca?: string
  limit?: number
}

export function useInsightsTopClientes(opts: UseInsightsTopClientesOptions = {}) {
  const { cidade, estado, busca, limit = 50 } = opts
  return useQuery({
    queryKey: ['insights', 'top-clientes', { cidade, estado, busca, limit }],
    queryFn: async (): Promise<InsightsTopCliente[]> => {
      let q = supabase
        .from('alwayson_insights_v_clientes')
        .select('*')
        .order('faturamento_total', { ascending: false })
        .limit(limit)

      if (cidade) q = q.eq('cidade', cidade)
      if (estado) q = q.eq('estado', estado)
      if (busca) {
        q = q.or(`nome_cliente.ilike.%${busca}%,cnpj_cliente.ilike.%${busca}%`)
      }

      const { data, error } = await q
      if (error) throw error
      return data as InsightsTopCliente[]
    },
    staleTime: 60_000,
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useInsightsTopClientes.ts
git commit -m "feat(insights): add hook for client ranking"
```

---

### Tarefa 1.5: Hooks `useInsightsClienteHistorico` e `useInsightsClienteMix`

**Files:**
- Create: `src/hooks/useInsightsClienteHistorico.ts`
- Create: `src/hooks/useInsightsClienteMix.ts`

- [ ] **Step 1: Implementar `useInsightsClienteHistorico`**

```typescript
// src/hooks/useInsightsClienteHistorico.ts
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { InsightsClienteMes } from '@/types/insights'

export function useInsightsClienteHistorico(cnpj?: string) {
  return useQuery({
    queryKey: ['insights', 'cliente-historico', cnpj],
    enabled: !!cnpj,
    queryFn: async (): Promise<InsightsClienteMes[]> => {
      const { data, error } = await supabase
        .from('alwayson_insights_v_cliente_mes')
        .select('*')
        .eq('cnpj_cliente', cnpj!)
        .order('ano_mes', { ascending: true })

      if (error) throw error
      return data as InsightsClienteMes[]
    },
    staleTime: 60_000,
  })
}
```

- [ ] **Step 2: Implementar `useInsightsClienteMix`**

```typescript
// src/hooks/useInsightsClienteMix.ts
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { InsightsClienteMixRow } from '@/types/insights'

export function useInsightsClienteMix(cnpj?: string) {
  return useQuery({
    queryKey: ['insights', 'cliente-mix', cnpj],
    enabled: !!cnpj,
    queryFn: async (): Promise<InsightsClienteMixRow[]> => {
      const { data, error } = await supabase
        .from('alwayson_insights_v_cliente_mix')
        .select('*')
        .eq('cnpj_cliente', cnpj!)
        .order('faturamento_total', { ascending: false })

      if (error) throw error
      return data as InsightsClienteMixRow[]
    },
    staleTime: 60_000,
  })
}
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useInsightsClienteHistorico.ts src/hooks/useInsightsClienteMix.ts
git commit -m "feat(insights): add hooks for client drilldown"
```

---

### Tarefa 1.6: Refatorar `InsightsPanel.tsx` para usar hooks reais

**Files:**
- Modify: `src/pages/InsightsPanel.tsx`

- [ ] **Step 1: Ler o arquivo atual e identificar todos os imports de `useMockInsights`**

Comando: abrir `src/pages/InsightsPanel.tsx`. Listar mentalmente onde cada `MOCK_*` é usado.

- [ ] **Step 2: Substituir cada uso de mock pelo hook real correspondente**

Mapeamento:
| Mock | Hook substituto |
|------|-----------------|
| `MOCK_CIDADES` | `useInsightsCidades({ estado, busca })` |
| `MOCK_TOP_CLIENTES` | `useInsightsTopClientes({ cidade, estado, busca })` |
| `MOCK_CLIENTE_HISTORICO` | `useInsightsClienteHistorico(cnpjSelecionado)` |
| `MOCK_CLIENTE_MIX` | `useInsightsClienteMix(cnpjSelecionado)` |
| KPIs hardcoded do header | `useInsightsKpisGerais()` |

Cada hook retorna `{ data, isLoading, error }`. Adicionar tratamento de loading (spinner ou skeleton) e error (mensagem) onde antes era acesso direto ao array.

- [ ] **Step 3: Empty state**

Quando `data` vier vazio (sem uploads ainda), mostrar:

```tsx
<div className="text-center py-12">
  <p className="text-muted-foreground">Nenhum dado de Insights carregado ainda.</p>
  <p className="text-sm text-muted-foreground mt-2">
    O time Arruda precisa fazer upload do XLSX em <code>/admin/insights</code>.
  </p>
</div>
```

- [ ] **Step 4: Verificar via dev server**

`npm run dev` → `/insights`. Esperado: empty state aparece (banco vazio). Sem erros no console. Filtros não quebram quando data está vazio.

- [ ] **Step 5: Inserir uma linha de teste no banco e re-verificar**

No SQL Editor (como service_role / Postgres user):

```sql
INSERT INTO alwayson_insights_uploads (nome, periodo_inicio, periodo_fim, arquivo_nome, status, total_nfs, total_itens)
VALUES ('Teste manual', '2026-01-01', '2026-03-31', 'teste.xlsx', 'concluido', 1, 1)
RETURNING id;
-- copiar o id retornado

INSERT INTO alwayson_insights_nf (upload_id, numero_nf, data_emissao, cnpj_cliente, nome_cliente, cidade, estado, valor_total)
VALUES ('<id_acima>', '0001', '2026-03-15', '12345678000100', 'Cliente Teste', 'João Pessoa', 'PB', 1500.00)
RETURNING id;

INSERT INTO alwayson_insights_nf_itens (nf_id, sku, descricao, quantidade, unidade, valor_unitario, valor_total)
VALUES ('<nf_id>', 'SKU-001', 'Produto Teste', 10, 'UN', 150.00, 1500.00);
```

Recarregar `/insights`. Esperado: 1 cidade (João Pessoa), 1 cliente, R$ 1.500 no header. Drill-down no cliente mostra 1 mês de histórico e 1 SKU no mix.

- [ ] **Step 6: Limpar dados de teste**

```sql
DELETE FROM alwayson_insights_uploads WHERE nome = 'Teste manual';
-- CASCADE limpa nf e itens
```

- [ ] **Step 7: Commit**

```bash
git add src/pages/InsightsPanel.tsx
git commit -m "feat(insights): replace mocks with real Supabase hooks"
```

---

### Tarefa 1.7: Hook + UI da aba Produtos

**Files:**
- Create: `src/hooks/useInsightsProdutos.ts`
- Create: `src/components/insights/InsightsAbaProdutos.tsx`
- Modify: `src/pages/InsightsPanel.tsx`

- [ ] **Step 1: Criar tipo `InsightsProdutoRow`**

Adicionar em `src/types/insights.ts`:

```typescript
/** Visão por SKU — aba Produtos do Insights. */
export interface InsightsProdutoRow {
  sku: string
  descricao?: string
  categoria?: string
  faturamento_total: number
  quantidade_total: number
  unidade?: string
  total_nfs: number
  total_clientes: number
  total_cidades: number
  primeira_venda: string
  ultima_venda: string
}
```

- [ ] **Step 2: Implementar o hook**

```typescript
// src/hooks/useInsightsProdutos.ts
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { InsightsProdutoRow } from '@/types/insights'

interface UseInsightsProdutosOptions {
  categoria?: string
  busca?: string
}

export function useInsightsProdutos(opts: UseInsightsProdutosOptions = {}) {
  const { categoria, busca } = opts
  return useQuery({
    queryKey: ['insights', 'produtos', { categoria, busca }],
    queryFn: async (): Promise<InsightsProdutoRow[]> => {
      let q = supabase
        .from('alwayson_insights_v_produtos')
        .select('*')
        .order('faturamento_total', { ascending: false })

      if (categoria) q = q.eq('categoria', categoria)
      if (busca) q = q.or(`sku.ilike.%${busca}%,descricao.ilike.%${busca}%`)

      const { data, error } = await q
      if (error) throw error
      return data as InsightsProdutoRow[]
    },
    staleTime: 60_000,
  })
}
```

- [ ] **Step 3: Implementar o componente da aba**

```tsx
// src/components/insights/InsightsAbaProdutos.tsx
import { useState } from 'react'
import { useInsightsProdutos } from '@/hooks/useInsightsProdutos'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'

export function InsightsAbaProdutos() {
  const [busca, setBusca] = useState('')
  const [categoria, setCategoria] = useState<string | undefined>()
  const { data, isLoading } = useInsightsProdutos({ busca, categoria })

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Carregando…</div>
  if (!data || data.length === 0) {
    return <div className="p-8 text-center text-muted-foreground">Nenhum produto encontrado.</div>
  }

  const categorias = Array.from(new Set(data.map(p => p.categoria).filter(Boolean))) as string[]

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <Input
          placeholder="Buscar SKU ou descrição..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          className="max-w-sm"
        />
        <select
          value={categoria ?? ''}
          onChange={e => setCategoria(e.target.value || undefined)}
          className="border rounded px-3"
        >
          <option value="">Todas as categorias</option>
          {categorias.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted/40 text-left text-sm">
            <tr>
              <th className="p-3">SKU</th>
              <th className="p-3">Descrição</th>
              <th className="p-3">Categoria</th>
              <th className="p-3 text-right">Faturamento</th>
              <th className="p-3 text-right">Qtd.</th>
              <th className="p-3 text-right">Clientes</th>
              <th className="p-3 text-right">Cidades</th>
              <th className="p-3">Última venda</th>
            </tr>
          </thead>
          <tbody>
            {data.map(p => (
              <tr key={p.sku} className="border-t">
                <td className="p-3 font-mono text-sm">{p.sku}</td>
                <td className="p-3">{p.descricao ?? '—'}</td>
                <td className="p-3">{p.categoria ?? '—'}</td>
                <td className="p-3 text-right">
                  {p.faturamento_total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </td>
                <td className="p-3 text-right">
                  {Number(p.quantidade_total).toLocaleString('pt-BR')} {p.unidade ?? ''}
                </td>
                <td className="p-3 text-right">{p.total_clientes}</td>
                <td className="p-3 text-right">{p.total_cidades}</td>
                <td className="p-3 text-sm text-muted-foreground">
                  {new Date(p.ultima_venda).toLocaleDateString('pt-BR')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
```

- [ ] **Step 4: Adicionar a aba ao `InsightsPanel`**

Em `InsightsPanel.tsx`, envolver o conteúdo em um `Tabs` (shadcn) com 3 abas: Territórios, Clientes, Produtos. As duas primeiras já existem — só agrupar dentro do componente Tabs e adicionar a terceira que renderiza `<InsightsAbaProdutos />`.

Se já houver um sistema de view-toggle no painel hoje (botões), substituir por `Tabs`.

- [ ] **Step 5: Verificar com dado de teste**

Repetir o INSERT da Tarefa 1.6 step 5, navegar pela aba Produtos. Esperado: 1 SKU listado, com 1 cliente / 1 cidade.

- [ ] **Step 6: Commit**

```bash
git add src/types/insights.ts src/hooks/useInsightsProdutos.ts src/components/insights/InsightsAbaProdutos.tsx src/pages/InsightsPanel.tsx
git commit -m "feat(insights): add Produtos tab with category filter"
```

---

### Tarefa 1.8: Especificar contrato do parser de Insights (doc)

> ⚠️ **A implementação real fica no repo Railway, fora deste plano.** Aqui só especificamos o contrato que o front e o backend vão honrar.

**Files:**
- Modify: `docs/INGESTAO_API_RAILWAY.md`

- [ ] **Step 1: Adicionar seção "Endpoint de Insights"**

Append ao final do arquivo:

```markdown
---

## Endpoint Insights (sell-out territorial)

### `POST /api/insights/ingest`

Upload de XLSX de sell-out do distribuidor para a aba Insights. Apenas usuários com role admin do time Arruda devem poder chamar (validação no front + service_role no parser).

**Headers:**
```
Content-Type: multipart/form-data
```

**Body (form-data):**
| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `file` | File | ✅ | XLSX/CSV de NFs (sell-out) |
| `nome` | string | ✅ | Nome legível do upload, ex: "Base Nordeste 2024-2026" |
| `periodo_inicio` | YYYY-MM-DD | ✅ | Início do período coberto |
| `periodo_fim` | YYYY-MM-DD | ✅ | Fim do período coberto |

**Resposta 202:** `{ id, status: 'processando' }`

**Schema esperado do XLSX (mesmas colunas da ingestão de vendas dos distribuidores):**
- `numero_nf`, `data_emissao`, `cnpj_cliente`, `nome_cliente`
- `codigo_vendedor`, `nome_vendedor`, `codigo_supervisor`, `nome_supervisor`, `codigo_gerente`, `nome_gerente`
- Por linha de item: `sku`, `descricao`, `quantidade`, `unidade`, `valor_unitario`, `valor_total`

**Side-effects no banco:**
1. Insere 1 row em `alwayson_insights_uploads` com `status='processando'`
2. Para cada NF única, insere 1 row em `alwayson_insights_nf`
3. Para cada item, insere 1 row em `alwayson_insights_nf_itens`
4. Calcula `valor_total` da NF como SUM dos itens
5. Enriquece `cidade/estado/lat/lng` via BrasilAPI/Nominatim a partir do CNPJ (idêntico à migration 006)
6. Atualiza upload para `status='concluido'` com `total_nfs`, `total_itens`
7. Em caso de erro: `status='erro'` + `erros` JSONB com detalhes

**Idempotência:** Constraint UNIQUE `(upload_id, cnpj_cliente, numero_nf)` previne duplicatas dentro do mesmo lote. Lotes diferentes podem repetir NFs (caso real: histórico vs incremental).
```

- [ ] **Step 2: Commit**

```bash
git add docs/INGESTAO_API_RAILWAY.md
git commit -m "docs(insights): specify Railway parser contract"
```

**Critério de aceite:** O time que cuida do Railway tem documento suficiente para implementar o endpoint.

---

### Tarefa 1.9: UI de upload de Insights no Admin

**Files:**
- Create: `src/components/insights/InsightsUploadDialog.tsx`
- Create: `src/pages/AdminInsights.tsx`
- Modify: `src/App.tsx`
- Modify: `src/pages/Admin.tsx`

- [ ] **Step 1: Adicionar rota**

Em `src/App.tsx`, dentro do bloco `/admin/*`:

```tsx
<Route path="/admin/insights" element={<AdminInsights />} />
```

- [ ] **Step 2: Adicionar link no hub do Admin**

Em `src/pages/Admin.tsx`, adicionar card/link para Insights ao lado dos demais (Distribuidores, Produtos, Metas, Excelência, Usuários).

- [ ] **Step 3: Criar `AdminInsights.tsx`**

```tsx
// src/pages/AdminInsights.tsx
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { InsightsUpload } from '@/types/insights'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import { InsightsUploadDialog } from '@/components/insights/InsightsUploadDialog'

export default function AdminInsights() {
  const [open, setOpen] = useState(false)
  const { data: uploads } = useQuery({
    queryKey: ['insights', 'uploads'],
    queryFn: async (): Promise<InsightsUpload[]> => {
      const { data, error } = await supabase
        .from('alwayson_insights_uploads')
        .select('*')
        .order('criado_em', { ascending: false })
      if (error) throw error
      return data as InsightsUpload[]
    },
  })

  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Uploads de Insights</h1>
        <Button onClick={() => setOpen(true)}>Novo upload</Button>
      </div>

      <table className="w-full border rounded">
        <thead className="bg-muted/40 text-left text-sm">
          <tr>
            <th className="p-3">Nome</th>
            <th className="p-3">Período</th>
            <th className="p-3">Arquivo</th>
            <th className="p-3">Status</th>
            <th className="p-3 text-right">NFs</th>
            <th className="p-3 text-right">Itens</th>
            <th className="p-3">Criado em</th>
          </tr>
        </thead>
        <tbody>
          {uploads?.map(u => (
            <tr key={u.id} className="border-t">
              <td className="p-3">{u.nome}</td>
              <td className="p-3 text-sm">{u.periodo_inicio} → {u.periodo_fim}</td>
              <td className="p-3 text-sm font-mono">{u.arquivo_nome}</td>
              <td className="p-3">
                <span className={
                  u.status === 'concluido' ? 'text-green-600' :
                  u.status === 'erro' ? 'text-red-600' : 'text-yellow-600'
                }>{u.status}</span>
              </td>
              <td className="p-3 text-right">{u.total_nfs ?? '—'}</td>
              <td className="p-3 text-right">{u.total_itens ?? '—'}</td>
              <td className="p-3 text-sm text-muted-foreground">
                {new Date(u.criado_em).toLocaleString('pt-BR')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <InsightsUploadDialog open={open} onOpenChange={setOpen} />
    </div>
  )
}
```

- [ ] **Step 4: Criar `InsightsUploadDialog.tsx`**

```tsx
// src/components/insights/InsightsUploadDialog.tsx
import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useQueryClient } from '@tanstack/react-query'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function InsightsUploadDialog({ open, onOpenChange }: Props) {
  const [nome, setNome] = useState('')
  const [periodoInicio, setPeriodoInicio] = useState('')
  const [periodoFim, setPeriodoFim] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const queryClient = useQueryClient()

  async function handleSubmit() {
    if (!file || !nome || !periodoInicio || !periodoFim) {
      setError('Preencha todos os campos.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('nome', nome)
      fd.append('periodo_inicio', periodoInicio)
      fd.append('periodo_fim', periodoFim)

      const res = await fetch(`${import.meta.env.VITE_INGESTAO_API_URL}/api/insights/ingest`, {
        method: 'POST',
        body: fd,
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.message ?? `HTTP ${res.status}`)
      }

      await queryClient.invalidateQueries({ queryKey: ['insights'] })
      onOpenChange(false)
      setNome(''); setPeriodoInicio(''); setPeriodoFim(''); setFile(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload de Insights</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nome do upload</Label>
            <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Base Nordeste 2026 Q1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Período início</Label>
              <Input type="date" value={periodoInicio} onChange={e => setPeriodoInicio(e.target.value)} />
            </div>
            <div>
              <Label>Período fim</Label>
              <Input type="date" value={periodoFim} onChange={e => setPeriodoFim(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Arquivo (XLSX/CSV)</Label>
            <Input type="file" accept=".xlsx,.xls,.csv" onChange={e => setFile(e.target.files?.[0] ?? null)} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Enviando…' : 'Enviar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 5: Verificação**

`npm run dev` → `/admin/insights`. Esperado: lista vazia com botão "Novo upload". Abrir dialog, validar formulário (sem submeter de verdade, pois o endpoint Railway ainda não existe). Fechar.

- [ ] **Step 6: Commit**

```bash
git add src/pages/AdminInsights.tsx src/components/insights/InsightsUploadDialog.tsx src/App.tsx src/pages/Admin.tsx
git commit -m "feat(insights): add admin UI for upload management"
```

---

### Tarefa 1.10: Limpeza — remover `useMockInsights.ts`

**Files:**
- Delete: `src/hooks/useMockInsights.ts`

- [ ] **Step 1: Confirmar zero referências**

```bash
grep -r "useMockInsights\|MOCK_CIDADES\|MOCK_TOP_CLIENTES\|MOCK_CLIENTE_HISTORICO\|MOCK_CLIENTE_MIX" src/
```

Esperado: nenhum resultado. Se houver, voltar e corrigir.

- [ ] **Step 2: Deletar e commitar**

```bash
git rm src/hooks/useMockInsights.ts
git commit -m "chore(insights): remove mock data hook"
```

---

### Critério de aceite — Fase 1

- [ ] `/insights` carrega do banco (empty state visível, sem mocks).
- [ ] Após inserir dados de teste manualmente, todas as 3 abas (Territórios, Clientes, Produtos) renderizam corretamente.
- [ ] `/admin/insights` lista uploads e o dialog de upload abre/valida (mesmo sem o endpoint Railway implementado ainda).
- [ ] Console limpo de erros.
- [ ] `useMockInsights.ts` deletado.
- [ ] Doc do Railway tem o contrato do endpoint Insights.

---

## Fase 2 — Ponte Performance → Insights (Roadmap)

> **Plano detalhado próprio será escrito quando esta fase for iniciada.**

**Goal:** Quando o usuário olhar a aba Performance/Cliente, sinalizar com um ícone discreto os clientes que têm dados no Insights, e oferecer um popover com comparação rápida + deep-link para a aba Insights filtrada.

**Dependências:** Fase 1 concluída (Insights precisa estar lendo do banco).

**Escopo:**
- Hook `useClientesComInsights(clienteIds: string[])` que retorna um Set de CNPJs presentes em `alwayson_insights_nf` (uma query batch).
- Componente `<InsightsBadge cliente={...} />` — ícone shadcn (provável `BarChart3` do lucide), cinza neutro.
- Componente `<InsightsComparativoPopover cliente={...} />` que faz 2 queries em paralelo: faturamento ingerido (sell-in) do período corrente × faturamento Insights (sell-out) do mesmo período. Mostra ambos lado a lado, variação numérica neutra (sem vermelho/verde), botão "Abrir no Insights →".
- Deep-link: `/insights?cnpj=<cnpj>` — `InsightsPanel` lê query param e filtra a aba Clientes diretamente.
- Integração nos componentes da aba Performance/Cliente (`Performance.tsx` ou específico, identificar no início).

**Critérios de aceite:**
- Badge aparece ao lado do nome de cliente apenas quando há dados em Insights.
- Popover não bloqueia interação principal (hover-card ou click controlado).
- Deep-link abre Insights já filtrado pelo CNPJ correto.
- Linguagem 100% neutra/informativa (sem "alerta", "divergência", "atenção").

**Não-objetivos:**
- ❌ Cálculo automático de divergência percentual com threshold.
- ❌ Notificação ou marcação de risco.
- ❌ Salvar histórico de comparações.

**Estimativa:** ~1 dia de trabalho, 4-5 commits.

---

## Fase 3 — Histórico de CNPJ (Roadmap)

> **Plano detalhado próprio será escrito quando esta fase for iniciada.**

**Goal:** Permitir que um cliente tenha múltiplos CNPJs ao longo do tempo, mantendo histórico unificado para análises e auditoria. Operação contextual no detalhe do cliente; auditoria centralizada no Admin.

**Dependências:** Nenhuma de Fase 1/2; pode rodar em paralelo se necessário, mas recomendo após Fase 1 para não competir por atenção.

**Escopo de schema:**

```sql
-- Migration 010 (proposta)
CREATE TABLE alwayson_clientes_cnpj_historico (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id      uuid NOT NULL REFERENCES alwayson_clientes_distribuidor(id),
  cnpj_anterior   text NOT NULL,
  cnpj_atual      text NOT NULL,
  motivo          text NOT NULL CHECK (motivo IN
                  ('mudanca_societaria','erro_cadastro','matriz_filial','outro')),
  observacao      text,
  criado_por      uuid REFERENCES auth.users(id),
  criado_em       timestamptz NOT NULL DEFAULT now(),
  reverted_em     timestamptz,
  reverted_por    uuid REFERENCES auth.users(id)
);

CREATE INDEX ON alwayson_clientes_cnpj_historico (cliente_id);
CREATE INDEX ON alwayson_clientes_cnpj_historico (cnpj_anterior);
```

**View de resolução:**

```sql
-- Retorna todos os CNPJs (atual + históricos) que pertencem a cada cliente
CREATE VIEW alwayson_clientes_v_cnpjs_resolvidos AS
SELECT id AS cliente_id, cnpj AS cnpj
FROM alwayson_clientes_distribuidor
UNION ALL
SELECT cliente_id, cnpj_anterior AS cnpj
FROM alwayson_clientes_cnpj_historico
WHERE reverted_em IS NULL;
```

**Hooks de faturamento e Insights** passam a usar esta view para resolver `cliente_id ↔ CNPJs[]`, garantindo que o histórico antigo (em outro CNPJ) entra automaticamente.

**Escopo de UI:**

- **Cliente Detalhe** (`/clientes/:id`):
  - Card "Histórico de CNPJs" listando vínculos com `cnpj_anterior`, motivo, data, autor.
  - Botão "Vincular outro CNPJ" → modal com inputs (CNPJ antigo, motivo dropdown, observação livre) → INSERT na nova tabela.
  - Após salvar, query de faturamento e Insights recarrega automaticamente (mais histórico aparece).

- **Admin / `/admin/cnpj-vinculos`**:
  - Tabela de todos os vínculos (com filtro por período, distribuidor, motivo).
  - Botão "Reverter" em cada linha → preenche `reverted_em` e `reverted_por` (não deleta — auditoria).
  - Sub-aba do hub Admin existente.

**Critérios de aceite:**
- Inserir um vínculo no detalhe do cliente faz o histórico de faturamento incluir NFs do CNPJ antigo automaticamente.
- Aba Insights filtrada pelo cliente passa a mostrar dados do CNPJ antigo também.
- Reversão no Admin remove o vínculo (estatisticamente) sem apagar o registro.
- Auditoria: sempre dá pra ver quem fez o vínculo e quando.

**Não-objetivos (cortar do escopo do Nexus):**
- ❌ Score automático de similaridade (entra como backlog distante).
- ❌ Workflow PENDING/APPROVED com 2 níveis de aprovação.
- ❌ Pattern de "pending changes / batch save".

**Riscos a vigiar:**
- **Performance:** a view `UNION ALL` pode ficar lenta com volume; criar índice em `cnpj_anterior` (já no schema acima) e materializar se necessário.
- **NF duplicada:** se o mesmo CNPJ antigo for vinculado a 2 clientes diferentes (erro de operação), precisa decidir: bloquear no INSERT ou alertar. Recomendo UNIQUE constraint em `(cnpj_anterior)` filtrado por `reverted_em IS NULL`.

**Estimativa:** ~2 dias, 6-8 commits.

---

## Self-Review

**Cobertura do spec:**
- ✅ Conectar Insights ao Supabase → Tarefas 1.1–1.6
- ✅ Aba Produtos no Insights → Tarefa 1.7
- ✅ Contrato do parser Railway → Tarefa 1.8
- ✅ UI de upload no Admin → Tarefa 1.9
- ✅ Limpeza de mocks → Tarefa 1.10
- ✅ Pré-requisito de RLS → Tarefas 0.1, 0.2
- 📋 Ponte Performance → Insights → Roadmap Fase 2
- 📋 Histórico de CNPJ → Roadmap Fase 3

**Ausência deliberada de TDD:** Justificada pela ausência de infra de testes no repo. Verificação por dev server + queries diretas no Supabase em cada step crítico.

**Trabalho fora do escopo:** Implementação do parser de XLSX no serviço Railway (`alwayson-ingestao-api`) — só especificamos o contrato.
