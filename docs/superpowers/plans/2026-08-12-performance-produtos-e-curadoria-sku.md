# Aba Produtos na Performance + Curadoria de SKU Órfão — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a sixth "Produtos" tab to the Performance screen (evolution-by-SKU, mirroring Gerência/Supervisão/Vendas) and a minimal SKU-curation admin flow at `/admin/produtos` that resolves the 7 orphan SKUs (and any future ones) via a de-para alias table — never a backfill, never a new catalog row.

**Architecture:** Two new Postgres views resolve everything at read time: a de-para table (`alwayson_faturamento_produto_de_para`) maps unresolved SKUs to existing catalog SKUs, and a monthly-by-SKU view (`alwayson_faturamento_v_mensal_produto`) resolves product names in cascade (`produto_id` direct → de-para alias → raw description) and feeds the same `EvolucaoGraficoNivel`/`ColunaEvolucao` components already used by the other Performance tabs. Hierarchy filtering (Gerente/Supervisor/Vendedor) happens client-side on the fetched rows, exactly like `VendasTab`/`ClienteTab` already do — no new rollup view needed, because "gerente" is a filter on who sold the SKU, not a dimension of the SKU itself.

**Tech Stack:** React 19 + TypeScript + TanStack Query + Supabase (Postgres/RLS/PostgREST) + Recharts, following the exact patterns already established in `src/pages/performance/*` and `src/pages/admin/AdminInsightsDeParaProdutos.tsx`.

## Global Constraints

- Supabase project ref **`osukbalwykbqvoumddxz`** — never the legacy `kgzybpelluftexrewyke`. Confirm before any DDL.
- Every new view **must** be created `WITH (security_invoker = true)` — otherwise it bypasses RLS.
- **Never expose a raw UUID in the UI.** SKUs are text, not UUIDs, but any `vendedor_id`/`fornecedor_tenant_id`/`distribuidor_id` touched by this work stays out of rendered text — see `src/lib/entity-labels.ts` convention in `CLAUDE.md`.
- Part B (de-para) is **alias-only** — `sku_fornecedor` is a `REFERENCES alwayson_produtos(sku)`; the UI must never allow creating a new catalog row. Follow `AdminInsightsDeParaProdutos.tsx`'s `handleVincularManual` validation exactly (green/amber real-time check against the catalog).
- No test framework exists in this repo (no vitest/jest, no `*.test.*`). Verification per task is: `npx tsc -b --noEmit`, `npm run build`, SQL cross-checks via the Supabase MCP tools, and — for UI tasks — manual check with `npm run dev` in the browser.
- RLS convention: one policy per table/action, no `USING (true)` on business tables, write policies use a dedicated `current_user_*_escopo_ok()` SECURITY DEFINER helper function (see migration `061` for the established shape).
- Ordering constraint: **the Part B migration (de-para table) must be applied before the Part A migration (monthly view)** — the view's `LEFT JOIN` references the de-para table by name and will fail to create otherwise.
- Migrations are saved to `docs/migrations/<NNN>_<name>.sql` (next available numbers: `069`, `070`) **and** applied live via the Supabase MCP `apply_migration` tool — both steps required, matching how every prior migration in this repo landed.

---

### Task 1: Migration 069 — de-para table, write RLS, pending-SKUs view (Part B data layer)

**Files:**
- Create: `docs/migrations/069_faturamento_produto_de_para.sql`

**Interfaces:**
- Consumes: `alwayson_produtos(sku, fornecedor_tenant_id)` (existing), `alwayson_memberships(tenant_id, user_id, ativo, role)` (existing), `public.current_user_is_admin()` (existing), `public.current_user_fornecedores_visiveis()` (existing, returns `TABLE(tenant_id uuid)`), `alwayson_faturamento_itens(sku, descricao, valor_total, produto_id, faturamento_id)` (existing), `alwayson_faturamento(id, data_emissao)` (existing).
- Produces: table `alwayson_faturamento_produto_de_para(id, sku_origem, sku_fornecedor, criado_por, criado_em)`; function `public.current_user_sku_fornecedor_gestor_ok(p_sku_fornecedor text) RETURNS boolean`; view `alwayson_faturamento_v_produtos_nao_mapeados(sku, descricao, faturamento_total, total_linhas)`. Task 2's view and Task 5's hooks both read these.

- [ ] **Step 1: Write the migration file**

```sql
-- Migration 069 — de-para de SKU órfão (faturamento → catálogo), curadoria em /admin/produtos.
--
-- Mesma forma do de-para do Insights (migration 011): tabela global (sem
-- distribuidor_id — um SKU físico é o mesmo produto em qualquer distribuidor),
-- resolução por LEFT JOIN na leitura, nunca escrita em alwayson_faturamento_itens.
-- Só alias: sku_fornecedor precisa já existir em alwayson_produtos (FK).
--
-- RLS mais restrita que o precedente do Insights (que é aberto a qualquer
-- authenticated): a leitura segue o escopo por fornecedor da migration 048, e a
-- escrita é limitada a admin global + gestor_fornecedor do fornecedor dono do
-- SKU alvo — segue o padrão de current_user_*_escopo_ok() da migration 061.
--
-- Projeto canônico: osukbalwykbqvoumddxz

CREATE TABLE IF NOT EXISTS alwayson_faturamento_produto_de_para (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_origem     text NOT NULL UNIQUE,
  sku_fornecedor text NOT NULL REFERENCES alwayson_produtos(sku) ON UPDATE CASCADE ON DELETE RESTRICT,
  criado_por     uuid REFERENCES auth.users(id),
  criado_em      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_faturamento_de_para_sku_fornecedor
  ON alwayson_faturamento_produto_de_para (sku_fornecedor);

COMMENT ON TABLE alwayson_faturamento_produto_de_para IS
  'Mapeamento SKU de origem (faturamento_itens.sku sem produto_id) → SKU oficial em alwayson_produtos. Global por fornecedor, sem distribuidor_id.';
COMMENT ON COLUMN alwayson_faturamento_produto_de_para.sku_origem IS
  'Valor de alwayson_faturamento_itens.sku para linhas com produto_id NULL.';
COMMENT ON COLUMN alwayson_faturamento_produto_de_para.sku_fornecedor IS
  'SKU único oficial; FK a alwayson_produtos.sku. Nunca cria produto novo — só alias.';

ALTER TABLE alwayson_faturamento_produto_de_para ENABLE ROW LEVEL SECURITY;

-- Helper: admin global OU gestor_fornecedor do fornecedor dono de p_sku_fornecedor.
CREATE OR REPLACE FUNCTION public.current_user_sku_fornecedor_gestor_ok(p_sku_fornecedor text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.current_user_is_admin()
    OR EXISTS (
      SELECT 1
      FROM alwayson_produtos p
      JOIN alwayson_memberships m ON m.tenant_id = p.fornecedor_tenant_id
      WHERE p.sku = p_sku_fornecedor
        AND m.user_id = auth.uid()
        AND m.ativo
        AND m.role = 'gestor_fornecedor'
    );
$$;

COMMENT ON FUNCTION public.current_user_sku_fornecedor_gestor_ok(text) IS
  'Autoriza escrita no de-para de produto quando o utilizador é admin global ou gestor do fornecedor dono do SKU alvo.';

REVOKE ALL ON FUNCTION public.current_user_sku_fornecedor_gestor_ok(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_sku_fornecedor_gestor_ok(text) TO authenticated;

CREATE POLICY alwayson_faturamento_produto_de_para_select_escopo
  ON alwayson_faturamento_produto_de_para FOR SELECT TO authenticated
  USING (
    public.current_user_is_admin()
    OR EXISTS (
      SELECT 1 FROM alwayson_produtos p
      WHERE p.sku = alwayson_faturamento_produto_de_para.sku_fornecedor
        AND p.fornecedor_tenant_id IN (SELECT f.tenant_id FROM public.current_user_fornecedores_visiveis() f)
    )
  );

CREATE POLICY alwayson_faturamento_produto_de_para_insert_escopo
  ON alwayson_faturamento_produto_de_para FOR INSERT TO authenticated
  WITH CHECK (public.current_user_sku_fornecedor_gestor_ok(sku_fornecedor));

CREATE POLICY alwayson_faturamento_produto_de_para_delete_escopo
  ON alwayson_faturamento_produto_de_para FOR DELETE TO authenticated
  USING (public.current_user_sku_fornecedor_gestor_ok(sku_fornecedor));

-- View de pendentes: SKU faturado sem produto_id resolvido e sem alias ainda.
-- Agrupa só por sku (não por descricao) — a mesma SKU pode ter descricao
-- diferente entre uploads (achado em 2026-08-11); usa a mais recente (por
-- data de emissão da nota) como referência de exibição.
CREATE VIEW alwayson_faturamento_v_produtos_nao_mapeados
WITH (security_invoker = true) AS
SELECT
  i.sku,
  (array_agg(i.descricao ORDER BY f.data_emissao DESC))[1] AS descricao,
  sum(i.valor_total) AS faturamento_total,
  count(*) AS total_linhas
FROM alwayson_faturamento_itens i
JOIN alwayson_faturamento f ON f.id = i.faturamento_id
WHERE i.produto_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM alwayson_faturamento_produto_de_para d
    WHERE d.sku_origem = i.sku
  )
GROUP BY i.sku;

COMMENT ON VIEW alwayson_faturamento_v_produtos_nao_mapeados IS
  'SKUs faturados sem produto_id resolvido e sem alias no de-para — fila de curadoria em /admin/produtos.';
```

- [ ] **Step 2: Apply the migration to the live database**

Use the Supabase MCP `apply_migration` tool (project ref `osukbalwykbqvoumddxz`), passing the exact SQL from Step 1 with `name: "faturamento_produto_de_para"`.

- [ ] **Step 3: Verify the objects exist and RLS is correctly wired**

Run via the Supabase MCP `execute_sql` tool (project ref `osukbalwykbqvoumddxz`):

```sql
SELECT
  (SELECT count(*) FROM pg_policies WHERE tablename = 'alwayson_faturamento_produto_de_para') AS policy_count,
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'alwayson_faturamento_produto_de_para') AS rls_enabled,
  (SELECT count(*) FROM alwayson_faturamento_produto_de_para) AS row_count,
  (SELECT count(*) FROM alwayson_faturamento_v_produtos_nao_mapeados) AS pendentes_count;
```

Expected: `policy_count = 3`, `rls_enabled = true`, `row_count = 0` (table is new and empty), `pendentes_count = 7` (the 7 orphan SKUs identified during brainstorming — if this differs, note the new number, it does not block the task since it reflects live data, not a bug).

- [ ] **Step 4: Run the Supabase advisor check**

Use the Supabase MCP `get_advisors` tool with `type: "security"`. Confirm no new lint fires against `alwayson_faturamento_produto_de_para` or `alwayson_faturamento_v_produtos_nao_mapeados` (e.g. no "RLS enabled, no policy" warning — Step 3 already confirms 3 policies exist).

- [ ] **Step 5: Commit**

```bash
git add docs/migrations/069_faturamento_produto_de_para.sql
git commit -m "feat(db): tabela de-para de SKU órfão de faturamento + view de pendentes"
```

---

### Task 2: Migration 070 — monthly-by-SKU view (Part A data layer)

**Files:**
- Create: `docs/migrations/070_faturamento_v_mensal_produto.sql`

**Interfaces:**
- Consumes: `alwayson_faturamento(id, distribuidor_id, fornecedor_tenant_id, vendedor_id, data_emissao, numero_nf)` (existing), `alwayson_faturamento_itens(faturamento_id, sku, descricao, valor_total, produto_id)` (existing), `alwayson_produtos(id, sku, descricao)` (existing), `alwayson_faturamento_produto_de_para(sku_origem, sku_fornecedor)` (Task 1).
- Produces: view `alwayson_faturamento_v_mensal_produto(distribuidor_id, fornecedor_tenant_id, vendedor_id, sku, nome_produto, mes, faturamento, nfs)`. Task 3's hook (`useSerieProduto`) reads this view by name and column list — do not rename any column without updating that hook.

- [ ] **Step 1: Write the migration file**

```sql
-- Migration 070 — view mensal por SKU e vendedor para a aba Produtos da Performance.
--
-- Grão (distribuidor_id, fornecedor_tenant_id, vendedor_id, sku, mes). Nome do
-- produto resolvido em cascata: produto_id direto (91% das linhas, já resolvido
-- na ingestão) → alwayson_faturamento_produto_de_para (migration 069, alias
-- manual) → descricao crua do item. Nunca fica sem nome.
--
-- Validado em 2026-08-12 (sem a Parte B, que ainda não existia): 9.484 linhas,
-- 36 SKUs, faturamento total batendo exato com o controle (R$ 15.104.043,07).
--
-- Projeto canônico: osukbalwykbqvoumddxz

CREATE VIEW alwayson_faturamento_v_mensal_produto
WITH (security_invoker = true) AS
SELECT
  f.distribuidor_id,
  f.fornecedor_tenant_id,
  f.vendedor_id,
  i.sku,
  COALESCE(p_direto.descricao, p_alias.descricao, i.descricao) AS nome_produto,
  date_trunc('month', f.data_emissao)::date AS mes,
  sum(i.valor_total) AS faturamento,
  count(DISTINCT f.numero_nf) AS nfs
FROM alwayson_faturamento f
JOIN alwayson_faturamento_itens i ON i.faturamento_id = f.id
LEFT JOIN alwayson_produtos p_direto ON p_direto.id = i.produto_id
LEFT JOIN alwayson_faturamento_produto_de_para depara
  ON depara.sku_origem = i.sku AND i.produto_id IS NULL
LEFT JOIN alwayson_produtos p_alias ON p_alias.sku = depara.sku_fornecedor
GROUP BY 1, 2, 3, 4, 5, 6;

COMMENT ON VIEW alwayson_faturamento_v_mensal_produto IS
  'Série mensal de faturamento por SKU e vendedor, para a aba Produtos da Performance (src/pages/performance/ProdutoTab.tsx).';
```

- [ ] **Step 2: Apply the migration to the live database**

Use the Supabase MCP `apply_migration` tool (project ref `osukbalwykbqvoumddxz`), passing the exact SQL from Step 1 with `name: "faturamento_v_mensal_produto"`.

- [ ] **Step 3: Verify the total reconciles exactly with the control sum**

Run via the Supabase MCP `execute_sql` tool:

```sql
SELECT
  count(*) AS linhas,
  count(DISTINCT sku) AS skus,
  round(sum(faturamento)::numeric, 2) AS faturamento_total
FROM alwayson_faturamento_v_mensal_produto;
```

Expected: `linhas = 9484`, `skus = 36`, `faturamento_total = 15104043.07`. This must match exactly — any difference means a row was double-counted or dropped by the joins.

- [ ] **Step 4: Verify no SKU is nameless**

```sql
SELECT count(*) FROM alwayson_faturamento_v_mensal_produto WHERE nome_produto IS NULL OR trim(nome_produto) = '';
```

Expected: `0`.

- [ ] **Step 5: Commit**

```bash
git add docs/migrations/070_faturamento_v_mensal_produto.sql
git commit -m "feat(db): view mensal por SKU e vendedor para a aba Produtos"
```

---

### Task 3: Part A hook — `useSerieProduto`

**Files:**
- Create: `src/hooks/useSerieProduto.ts`

**Interfaces:**
- Consumes: `alwayson_faturamento_v_mensal_produto` (Task 2); `Janela` type from `@/lib/janela-periodo` (existing: `{ inicio: string; fim: string; meses: string[] }`); `SerieEntidade` type from `@/hooks/useSerieEntidade` (existing: `{ valores: number[]; total: number }`).
- Produces: `useSerieProduto(distribuidorId: string | undefined, janela: Janela): UseQueryResult<LinhaSerieProduto[]>`; `montarSeriesProduto(linhas: LinhaSerieProduto[], janela: Janela, vendedorIdsPermitidos: Set<string> | null): { series: Map<string, SerieEntidade>; nomes: Map<string, string> }`. Task 4's `ProdutoTab.tsx` imports both by these exact names.

- [ ] **Step 1: Write the hook file**

```typescript
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Janela } from '@/lib/janela-periodo'
import type { SerieEntidade } from '@/hooks/useSerieEntidade'

export interface LinhaSerieProduto {
  sku: string
  nomeProduto: string
  vendedorId: string | null
  mes: string
  faturamento: number
}

const PAGE = 1000

/** Pagina a view mensal por produto; sem isto o Supabase corta em 1000 linhas em silêncio. */
async function carregarProdutoPaginado(
  distribuidorId: string | undefined,
  janela: Janela
): Promise<LinhaSerieProduto[]> {
  const all: LinhaSerieProduto[] = []
  let from = 0
  for (;;) {
    let q = supabase
      .from('alwayson_faturamento_v_mensal_produto')
      .select('sku, nome_produto, vendedor_id, mes, faturamento')
      .gte('mes', `${janela.inicio}-01`)
      .lte('mes', `${janela.fim}-01`)
      .order('sku')
      .order('mes')
      .range(from, from + PAGE - 1)

    if (distribuidorId) q = q.eq('distribuidor_id', distribuidorId)

    const { data, error } = await q
    if (error) throw error
    const chunk = data ?? []
    for (const row of chunk) {
      const r = row as unknown as Record<string, unknown>
      all.push({
        sku: String(r.sku),
        nomeProduto: String(r.nome_produto),
        vendedorId: r.vendedor_id == null ? null : String(r.vendedor_id),
        mes: String(r.mes),
        faturamento: Number(r.faturamento),
      })
    }
    if (chunk.length < PAGE) break
    from += PAGE
  }
  return all
}

export function useSerieProduto(distribuidorId: string | undefined, janela: Janela) {
  return useQuery({
    queryKey: ['serie-produto', distribuidorId ?? 'all', janela.inicio, janela.fim],
    queryFn: () => carregarProdutoPaginado(distribuidorId, janela),
  })
}

/**
 * Agrega linhas cruas em séries por SKU, filtrando por vendedor quando um
 * recorte de hierarquia está ativo. `vendedorIdsPermitidos = null` significa
 * sem filtro (todos os vendedores); um Set vazio significa filtro ativo sem
 * nenhum vendedor elegível (ex.: supervisor sem subordinados) — nesse caso
 * nenhuma linha passa e as séries voltam vazias, de propósito.
 */
export function montarSeriesProduto(
  linhas: LinhaSerieProduto[],
  janela: Janela,
  vendedorIdsPermitidos: Set<string> | null
): { series: Map<string, SerieEntidade>; nomes: Map<string, string> } {
  const indicePorMes = new Map(janela.meses.map((m, i) => [m, i]))
  const series = new Map<string, SerieEntidade>()
  const nomes = new Map<string, string>()

  for (const l of linhas) {
    if (vendedorIdsPermitidos && (!l.vendedorId || !vendedorIdsPermitidos.has(l.vendedorId))) {
      continue
    }
    const mesChave = l.mes.slice(0, 7)
    const i = indicePorMes.get(mesChave)
    if (i === undefined) continue

    let serie = series.get(l.sku)
    if (!serie) {
      serie = { valores: new Array(janela.meses.length).fill(0), total: 0 }
      series.set(l.sku, serie)
    }
    serie.valores[i] += l.faturamento
    serie.total += l.faturamento
    nomes.set(l.sku, l.nomeProduto)
  }

  return { series, nomes }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -b --noEmit`
Expected: no errors referencing `useSerieProduto.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useSerieProduto.ts
git commit -m "feat: hook de série mensal por SKU (useSerieProduto)"
```

---

### Task 4: Part A tab — `ProdutoTab.tsx` and wiring into Performance

**Files:**
- Create: `src/pages/performance/ProdutoTab.tsx`
- Modify: `src/pages/performance/usePerfFilters.ts`
- Modify: `src/hooks/usePerformanceHierarchy.ts`
- Modify: `src/pages/performance/PerformanceContext.tsx`
- Modify: `src/pages/Performance.tsx`

**Interfaces:**
- Consumes: `useSerieProduto`, `montarSeriesProduto` (Task 3); `useVendedorHierarchy` (existing, `src/hooks/usePerformanceHierarchy.ts`); `EvolucaoGraficoNivel`, `ColunaEvolucao`/`calcularVariacaoLinha`, `SortableNumericHead`/`useSortedMetricRows`, `hierarchyPersonLabel` (all existing, unmodified); `usePerformanceContext` (existing).
- Produces: exported component `ProdutoTab()`, registered as `TAB_COMPONENTS.produtos` in `Performance.tsx`. `'produtos'` added to the `PerfTab` union everywhere it's enumerated.

- [ ] **Step 1: Add `'produtos'` to the tab type system**

In `src/pages/performance/usePerfFilters.ts`, change:

```typescript
export type PerfTab = 'distribuidor' | 'gerencia' | 'supervisao' | 'vendas' | 'cliente'

export const TAB_ORDER: PerfTab[] = ['distribuidor', 'gerencia', 'supervisao', 'vendas', 'cliente']
```

to:

```typescript
export type PerfTab = 'distribuidor' | 'gerencia' | 'supervisao' | 'vendas' | 'cliente' | 'produtos'

export const TAB_ORDER: PerfTab[] = ['distribuidor', 'gerencia', 'supervisao', 'vendas', 'cliente', 'produtos']
```

and change:

```typescript
export const TAB_LABELS: Record<PerfTab, string> = {
  distribuidor: 'Distribuidor',
  gerencia: 'Gerência',
  supervisao: 'Supervisão',
  vendas: 'Vendas',
  cliente: 'Cliente',
}
```

to:

```typescript
export const TAB_LABELS: Record<PerfTab, string> = {
  distribuidor: 'Distribuidor',
  gerencia: 'Gerência',
  supervisao: 'Supervisão',
  vendas: 'Vendas',
  cliente: 'Cliente',
  produtos: 'Produtos',
}
```

- [ ] **Step 2: Add `'produtos'` to available levels in the hierarchy hook**

In `src/hooks/usePerformanceHierarchy.ts`, inside `useVendedorHierarchy`'s `queryFn`, change:

```typescript
      const availableLevels: PerfTab[] = ['distribuidor']
      if (gerentes.length > 0) availableLevels.push('gerencia')
      if (supervisores.length > 0) availableLevels.push('supervisao')
      availableLevels.push('vendas', 'cliente')
```

to:

```typescript
      const availableLevels: PerfTab[] = ['distribuidor']
      if (gerentes.length > 0) availableLevels.push('gerencia')
      if (supervisores.length > 0) availableLevels.push('supervisao')
      availableLevels.push('vendas', 'cliente', 'produtos')
```

- [ ] **Step 3: Add `'produtos'` to the two hardcoded default-tab arrays**

In `src/pages/performance/PerformanceContext.tsx`, change:

```typescript
  const [availableTabs, setAvailableTabs] = useState<PerfTab[]>(['distribuidor', 'vendas', 'cliente'])
```

to:

```typescript
  const [availableTabs, setAvailableTabs] = useState<PerfTab[]>(['distribuidor', 'vendas', 'cliente', 'produtos'])
```

In `src/pages/Performance.tsx`, change:

```typescript
    if (!filters.distribuidorId) {
      setAvailableTabs(['distribuidor', 'vendas', 'cliente'])
      return
    }
```

to:

```typescript
    if (!filters.distribuidorId) {
      setAvailableTabs(['distribuidor', 'vendas', 'cliente', 'produtos'])
      return
    }
```

- [ ] **Step 4: Write `ProdutoTab.tsx`**

```tsx
import { useMemo } from 'react'
import { FilterBar, FilterField } from '@/components/distribuidor/FilterBar'
import { useVendedorHierarchy } from '@/hooks/usePerformanceHierarchy'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/format'
import { usePerformanceContext } from './PerformanceContext'
import { SortableNumericHead, useSortedMetricRows } from './sortableNumeric'
import { hierarchyPersonLabel } from './hierarchyLabels'
import { ColunaEvolucao, calcularVariacaoLinha } from './ColunaEvolucao'
import { useSerieProduto, montarSeriesProduto } from '@/hooks/useSerieProduto'
import { calcularJanela, calcularComparacao } from '@/lib/janela-periodo'
import { EvolucaoGraficoNivel } from './EvolucaoGraficoNivel'

export function ProdutoTab() {
  const { filters, setFilter } = usePerformanceContext()
  const { distribuidorId, gerenteId, supervisorId, vendedorId } = filters

  const { data: hierarchy, isLoading: loadingHierarchy } =
    useVendedorHierarchy(distribuidorId)

  const janela = calcularJanela(filters.janela)
  const comparacao = calcularComparacao(janela, filters.comparar)
  const { data: linhas, isLoading: loadingSerie } = useSerieProduto(distribuidorId, janela)
  const { data: linhasAnterior } = useSerieProduto(distribuidorId, comparacao ?? janela)

  const isLoading = loadingHierarchy || loadingSerie

  const gerentesForFilter = useMemo(() => hierarchy?.gerentes ?? [], [hierarchy])

  const supervisoresForFilter = useMemo(() => {
    if (!hierarchy) return []
    if (gerenteId) {
      return hierarchy.supervisores.filter((s) => s.supervisor_id === gerenteId)
    }
    return hierarchy.supervisores
  }, [hierarchy, gerenteId])

  const vendedoresForFilter = useMemo(() => {
    if (!hierarchy) return []
    let list = hierarchy.vendedoresOnly
    if (supervisorId) {
      list = list.filter((v) => v.supervisor_id === supervisorId)
    } else if (gerenteId) {
      const subIds = hierarchy.getSubordinateIds(gerenteId)
      list = list.filter((v) => subIds.includes(v.id))
    }
    return list
  }, [hierarchy, supervisorId, gerenteId])

  const vendedorIdsPermitidos = useMemo(() => {
    if (!hierarchy) return null
    if (vendedorId) return new Set([vendedorId])
    if (supervisorId) {
      return new Set([supervisorId, ...hierarchy.getSubordinateIds(supervisorId)])
    }
    if (gerenteId) {
      return new Set([gerenteId, ...hierarchy.getSubordinateIds(gerenteId)])
    }
    return null
  }, [hierarchy, gerenteId, supervisorId, vendedorId])

  const { series, nomes } = useMemo(
    () => montarSeriesProduto(linhas ?? [], janela, vendedorIdsPermitidos),
    [linhas, janela, vendedorIdsPermitidos]
  )
  const { series: seriesAnterior } = useMemo(
    () => montarSeriesProduto(linhasAnterior ?? [], comparacao ?? janela, vendedorIdsPermitidos),
    [linhasAnterior, comparacao, janela, vendedorIdsPermitidos]
  )

  const entidades = useMemo(
    () => Array.from(nomes.entries()).map(([id, nome]) => ({ id, nome })),
    [nomes]
  )

  const rows = useMemo(() => {
    return entidades.map((entidade) => {
      const serie = series.get(entidade.id)
      return {
        id: entidade.id,
        nome: entidade.nome,
        faturamento: serie?.total ?? 0,
        variacao: calcularVariacaoLinha(
          serie,
          comparacao ? seriesAnterior.get(entidade.id) : undefined
        ),
      }
    })
  }, [entidades, series, seriesAnterior, comparacao])

  const { sortedRows, sortField, sortDir, toggleSort } = useSortedMetricRows(rows)

  if (!distribuidorId) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-muted-foreground">
          Selecione um distribuidor para visualizar produtos
        </p>
      </div>
    )
  }

  const showGerenteFilter = gerentesForFilter.length > 0
  const showSupervisorFilter = supervisoresForFilter.length > 0
  const showVendedorFilter = vendedoresForFilter.length > 0
  const filterCount = [showGerenteFilter, showSupervisorFilter, showVendedorFilter].filter(
    Boolean
  ).length
  const filterColumns = Math.min(Math.max(filterCount, 2), 4) as 2 | 3 | 4

  return (
    <div className="space-y-6 mt-4">
      {filterCount > 0 && (
        <FilterBar columns={filterColumns}>
          {showGerenteFilter && (
            <FilterField label="Gerente">
              <Select
                value={gerenteId ?? 'todos'}
                onValueChange={(v) =>
                  setFilter('gerenteId', v === 'todos' ? undefined : (v as string))
                }
              >
                <SelectTrigger className="h-8 w-full text-sm">
                  <SelectValue placeholder="Todos">
                    {gerenteId ? hierarchyPersonLabel(hierarchy, gerenteId, 'Gerente') : 'Todos'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {gerentesForFilter.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>
          )}
          {showSupervisorFilter && (
            <FilterField label="Supervisor">
              <Select
                value={supervisorId ?? 'todos'}
                onValueChange={(v) =>
                  setFilter('supervisorId', v === 'todos' ? undefined : (v as string))
                }
              >
                <SelectTrigger className="h-8 w-full text-sm">
                  <SelectValue placeholder="Todos">
                    {supervisorId
                      ? hierarchyPersonLabel(hierarchy, supervisorId, 'Supervisor')
                      : 'Todos'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {supervisoresForFilter.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>
          )}
          {showVendedorFilter && (
            <FilterField label="Vendedor">
              <Select
                value={vendedorId ?? 'todos'}
                onValueChange={(v) =>
                  setFilter('vendedorId', v === 'todos' ? undefined : (v as string))
                }
              >
                <SelectTrigger className="h-8 w-full text-sm">
                  <SelectValue placeholder="Todos">
                    {vendedorId
                      ? hierarchyPersonLabel(hierarchy, vendedorId, 'Vendedor')
                      : 'Todos'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {vendedoresForFilter.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>
          )}
        </FilterBar>
      )}

      <EvolucaoGraficoNivel
        janela={janela}
        comparacao={comparacao}
        entidades={entidades}
        series={series}
        seriesAnterior={seriesAnterior}
        onEntidadeClick={() => {}}
      />

      <Card>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>SKU</TableHead>
              <SortableNumericHead
                label="Faturamento"
                field="faturamento"
                sortField={sortField}
                sortDir={sortDir}
                onSort={toggleSort}
              />
              <SortableNumericHead
                label="Evolução"
                field="variacao"
                sortField={sortField}
                sortDir={sortDir}
                onSort={toggleSort}
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 3 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : sortedRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="py-8 text-center">
                  <p className="text-xs text-muted-foreground">Nenhum produto encontrado</p>
                </TableCell>
              </TableRow>
            ) : (
              sortedRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-xs font-medium">
                    <span className="font-mono">{row.id}</span>
                    <p className="text-[11px] font-normal text-muted-foreground">{row.nome}</p>
                  </TableCell>
                  <TableCell className="text-xs tabular-nums text-right">
                    {formatCurrency(row.faturamento)}
                  </TableCell>
                  <ColunaEvolucao serie={series.get(row.id)} variacao={row.variacao} />
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
```

- [ ] **Step 5: Register the tab in `Performance.tsx`**

Add the import:

```typescript
import { ProdutoTab } from './performance/ProdutoTab'
```

Change:

```typescript
const TAB_COMPONENTS: Record<PerfTab, React.ComponentType> = {
  distribuidor: DistribuidorTab,
  gerencia: GerenciaTab,
  supervisao: SupervisaoTab,
  vendas: VendasTab,
  cliente: ClienteTab,
}
```

to:

```typescript
const TAB_COMPONENTS: Record<PerfTab, React.ComponentType> = {
  distribuidor: DistribuidorTab,
  gerencia: GerenciaTab,
  supervisao: SupervisaoTab,
  vendas: VendasTab,
  cliente: ClienteTab,
  produtos: ProdutoTab,
}
```

- [ ] **Step 6: Type-check and build**

Run: `npx tsc -b --noEmit`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 7: Manual verification in the browser**

Start the dev server (`npm run dev`), open `/performance`, select the one distribuidor with real data, and confirm:
- A "Produtos" tab appears after "Cliente".
- Clicking it shows the evolution chart (top-5 SKUs + "Outros") and a table with 36 rows (or fewer if a hierarchy filter is applied).
- The 7 orphan SKUs appear in the table with their raw description (from `alwayson_faturamento_itens.descricao`), not blank.
- Selecting a Vendedor in the filter narrows the table to only the SKUs that vendedor sold.
- Sum of the "Faturamento" column across all rows is R$ 15.104.043,07 (matches Task 2's Step 3 SQL check) when no window/hierarchy filter narrows it below the full 6-month default — note the UI default window is 6 months, so this full-series total will only show when "Toda a série" is selected in the Janela filter.

- [ ] **Step 8: Commit**

```bash
git add src/pages/performance/ProdutoTab.tsx src/pages/performance/usePerfFilters.ts src/hooks/usePerformanceHierarchy.ts src/pages/performance/PerformanceContext.tsx src/pages/Performance.tsx
git commit -m "feat(performance): aba Produtos com evolução por SKU"
```

---

### Task 5: Part B types and hooks

**Files:**
- Modify: `src/types/produto.ts`
- Create: `src/hooks/useFaturamentoProdutoDePara.ts`

**Interfaces:**
- Consumes: `alwayson_faturamento_produto_de_para`, `alwayson_faturamento_v_produtos_nao_mapeados` (Task 1).
- Produces: types `FaturamentoProdutoDePara`, `FaturamentoProdutoNaoMapeado` (from `src/types/produto.ts`); hooks `useFaturamentoProdutoDePara()`, `useFaturamentoProdutosNaoMapeados()`, `useUpsertFaturamentoProdutoDePara()` (mutation, `.mutateAsync({ sku_origem, sku_fornecedor })`), `useDeleteFaturamentoProdutoDePara()` (mutation, `.mutateAsync(skuOrigem: string)`). Task 6's `AdminProdutosCuradoria.tsx` imports all four hooks and both types by these exact names.

- [ ] **Step 1: Add the two new types to `src/types/produto.ts`**

Append to the existing file (after the `Produto` interface):

```typescript

/** De-para de SKU órfão do faturamento → SKU oficial em alwayson_produtos. */
export interface FaturamentoProdutoDePara {
  id: string
  sku_origem: string
  sku_fornecedor: string
  criado_por: string | null
  criado_em: string
}

/** SKU faturado sem produto_id resolvido e sem alias no de-para — fila de curadoria. */
export interface FaturamentoProdutoNaoMapeado {
  sku: string
  descricao: string
  faturamento_total: number
  total_linhas: number
}
```

- [ ] **Step 2: Write `src/hooks/useFaturamentoProdutoDePara.ts`**

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { FaturamentoProdutoDePara, FaturamentoProdutoNaoMapeado } from '@/types/produto'

function n(x: unknown): number {
  const v = Number(x)
  return Number.isFinite(v) ? v : 0
}

export function useFaturamentoProdutoDePara() {
  return useQuery({
    queryKey: ['faturamento-produto-de-para'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('alwayson_faturamento_produto_de_para')
        .select('*')
        .order('sku_origem')
      if (error) throw error
      return data as FaturamentoProdutoDePara[]
    },
  })
}

/** SKUs faturados sem produto_id resolvido e sem alias — fila de curadoria em /admin/produtos. */
export function useFaturamentoProdutosNaoMapeados() {
  return useQuery({
    queryKey: ['faturamento-produtos-nao-mapeados'],
    staleTime: 30_000,
    queryFn: async (): Promise<FaturamentoProdutoNaoMapeado[]> => {
      const { data, error } = await supabase
        .from('alwayson_faturamento_v_produtos_nao_mapeados')
        .select('*')
        .order('faturamento_total', { ascending: false })
        .limit(500)
      if (error) throw error
      return (data ?? []).map((row) => {
        const r = row as Record<string, unknown>
        return {
          sku: String(r.sku ?? ''),
          descricao: String(r.descricao ?? ''),
          faturamento_total: n(r.faturamento_total),
          total_linhas: Math.trunc(n(r.total_linhas)),
        }
      })
    },
  })
}

export function useUpsertFaturamentoProdutoDePara() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (args: { sku_origem: string; sku_fornecedor: string }) => {
      const skuOrigem = args.sku_origem.trim()
      const skuFornecedor = args.sku_fornecedor.trim()
      if (!skuOrigem || !skuFornecedor) return
      const { error } = await supabase
        .from('alwayson_faturamento_produto_de_para')
        .upsert({ sku_origem: skuOrigem, sku_fornecedor: skuFornecedor }, { onConflict: 'sku_origem' })
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['faturamento-produto-de-para'] })
      void qc.invalidateQueries({ queryKey: ['faturamento-produtos-nao-mapeados'] })
      void qc.invalidateQueries({ queryKey: ['serie-produto'] })
    },
  })
}

export function useDeleteFaturamentoProdutoDePara() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (skuOrigem: string) => {
      const sku = skuOrigem.trim()
      if (!sku) return
      const { error } = await supabase
        .from('alwayson_faturamento_produto_de_para')
        .delete()
        .eq('sku_origem', sku)
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['faturamento-produto-de-para'] })
      void qc.invalidateQueries({ queryKey: ['faturamento-produtos-nao-mapeados'] })
      void qc.invalidateQueries({ queryKey: ['serie-produto'] })
    },
  })
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 4: Live sanity check against the pending view**

Use the Supabase MCP `execute_sql` tool:

```sql
SELECT sku, descricao, faturamento_total, total_linhas
FROM alwayson_faturamento_v_produtos_nao_mapeados
ORDER BY faturamento_total DESC
LIMIT 10;
```

Expected: rows returned with non-null `descricao` for each — confirms the hook's row shape matches what the view actually returns.

- [ ] **Step 5: Commit**

```bash
git add src/types/produto.ts src/hooks/useFaturamentoProdutoDePara.ts
git commit -m "feat: tipos e hooks de curadoria de SKU órfão"
```

---

### Task 6: Part B UI — curation section at `/admin/produtos`

**Files:**
- Create: `src/pages/admin/AdminProdutosCuradoria.tsx`
- Modify: `src/pages/admin/AdminProdutos.tsx`

**Interfaces:**
- Consumes: `useFaturamentoProdutoDePara`, `useFaturamentoProdutosNaoMapeados`, `useUpsertFaturamentoProdutoDePara`, `useDeleteFaturamentoProdutoDePara` (Task 5); `useProdutos` (existing, `src/hooks/useProdutos.ts`); `normalizeDeParaCellValue` (existing, `src/lib/parseDeParaProdutoUpload.ts`).
- Produces: exported component `AdminProdutosCuradoria()`, rendered inside the existing `AdminProdutos` page component (route `/admin/produtos` already registered in `src/App.tsx:151` — no routing change needed).

**Known limitation to verify against, not to "fix":** the 7 orphan SKUs discovered during brainstorming are genuinely new products with no existing catalog match — per the design spec, linking them is explicitly out of scope (catalog creation stays SQL-manual). Manual verification in Step 4 below therefore cannot end-to-end-link one of the current 7; it verifies the amber "SKU ausente no catálogo" state and the RLS block instead.

- [ ] **Step 1: Write `src/pages/admin/AdminProdutosCuradoria.tsx`**

```tsx
import { useState } from 'react'
import { Link2, Loader2, Trash2, Unlink } from 'lucide-react'
import { SectionTitle } from '@/components/distribuidor/SectionTitle'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/format'
import { normalizeDeParaCellValue } from '@/lib/parseDeParaProdutoUpload'
import { useProdutos } from '@/hooks/useProdutos'
import {
  useFaturamentoProdutoDePara,
  useFaturamentoProdutosNaoMapeados,
  useUpsertFaturamentoProdutoDePara,
  useDeleteFaturamentoProdutoDePara,
} from '@/hooks/useFaturamentoProdutoDePara'

export function AdminProdutosCuradoria() {
  const { data: naoMapeados = [], isPending: loadingNaoMap } = useFaturamentoProdutosNaoMapeados()
  const { data: mapeados = [], isPending: loadingMapeados } = useFaturamentoProdutoDePara()
  const { data: produtos, isPending: loadingProdutos } = useProdutos()
  const upsert = useUpsertFaturamentoProdutoDePara()
  const remover = useDeleteFaturamentoProdutoDePara()

  const [skuDraft, setSkuDraft] = useState<Record<string, string>>({})
  const [linkingOrigem, setLinkingOrigem] = useState<string | null>(null)
  const [removendoOrigem, setRemovendoOrigem] = useState<string | null>(null)
  const [linkError, setLinkError] = useState<string | null>(null)
  const [linkNotice, setLinkNotice] = useState<string | null>(null)

  const skuValidos = new Set((produtos ?? []).map((p) => p.sku.trim()).filter(Boolean))
  const produtoBySku = new Map((produtos ?? []).map((p) => [p.sku.trim(), p.descricao]))

  const handleVincular = async (skuOrigem: string) => {
    setLinkError(null)
    setLinkNotice(null)
    const raw = (skuDraft[skuOrigem] ?? '').trim()
    const sku = normalizeDeParaCellValue(raw)
    if (!sku) {
      setLinkError('Informe o SKU do catálogo.')
      return
    }
    if (!skuValidos.has(sku)) {
      setLinkError(`SKU ${sku} não existe em Produtos.`)
      return
    }
    setLinkingOrigem(skuOrigem)
    try {
      await upsert.mutateAsync({ sku_origem: skuOrigem, sku_fornecedor: sku })
      setSkuDraft((prev) => {
        const next = { ...prev }
        delete next[skuOrigem]
        return next
      })
      setLinkNotice(`Vinculado ${skuOrigem} → ${sku}.`)
    } catch (e) {
      setLinkError(e instanceof Error ? e.message : 'Falha ao vincular')
    } finally {
      setLinkingOrigem(null)
    }
  }

  const handleRemover = async (skuOrigem: string) => {
    if (!confirm(`Remover o vínculo de "${skuOrigem}"? Ele volta para a fila de pendentes.`)) return
    setRemovendoOrigem(skuOrigem)
    try {
      await remover.mutateAsync(skuOrigem)
    } catch (e) {
      setLinkError(e instanceof Error ? e.message : 'Falha ao remover')
    } finally {
      setRemovendoOrigem(null)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <SectionTitle title="SKUs não mapeados" icon={Unlink} />
              <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
                Faturados sem produto correspondente no catálogo — vincule a um SKU já
                cadastrado para entrar na aba Produtos da Performance com nome legível.
              </p>
            </div>
            <Badge variant="secondary" className="tabular-nums">
              {naoMapeados.length.toLocaleString('pt-BR')} SKUs
            </Badge>
          </div>

          {linkError && <p className="text-xs text-destructive">{linkError}</p>}
          {linkNotice && (
            <p className="text-xs text-emerald-700 dark:text-emerald-400">{linkNotice}</p>
          )}

          {loadingNaoMap ? (
            <Skeleton className="mt-2 h-32 w-full" />
          ) : naoMapeados.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">
              Nenhum SKU pendente — todo o faturamento resolve para o catálogo.
            </p>
          ) : (
            <div className="max-h-[min(24rem,50vh)] overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs">SKU</TableHead>
                    <TableHead className="hidden text-xs md:table-cell">Descrição</TableHead>
                    <TableHead className="text-right text-xs">Faturamento</TableHead>
                    <TableHead className="min-w-[220px] text-xs">SKU do catálogo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {naoMapeados.map((r) => {
                    const draft = skuDraft[r.sku] ?? ''
                    const draftNorm = normalizeDeParaCellValue(draft)
                    const ok = draftNorm ? skuValidos.has(draftNorm) : false
                    const busy = linkingOrigem === r.sku || upsert.isPending
                    return (
                      <TableRow key={r.sku}>
                        <TableCell className="py-2 align-top font-mono text-xs font-medium">
                          {r.sku}
                        </TableCell>
                        <TableCell className="hidden max-w-[220px] truncate py-2 align-top text-xs text-muted-foreground md:table-cell">
                          {r.descricao || '—'}
                        </TableCell>
                        <TableCell className="py-2 text-right align-top text-xs tabular-nums">
                          {formatCurrency(r.faturamento_total)}
                          <p className="text-[10px] text-muted-foreground">
                            {r.total_linhas.toLocaleString('pt-BR')} linhas
                          </p>
                        </TableCell>
                        <TableCell className="py-2 align-top">
                          <div className="flex items-start gap-2">
                            <div className="min-w-0 flex-1">
                              <Input
                                value={draft}
                                onChange={(e) =>
                                  setSkuDraft((prev) => ({ ...prev, [r.sku]: e.target.value }))
                                }
                                placeholder="ex. 11.5004"
                                className="h-8 font-mono text-xs"
                              />
                              {draftNorm && (
                                <Tooltip>
                                  <TooltipTrigger
                                    type="button"
                                    className={cn(
                                      'mt-0.5 block w-full truncate text-left text-[10px]',
                                      ok
                                        ? 'text-emerald-700 dark:text-emerald-400'
                                        : 'text-amber-700'
                                    )}
                                  >
                                    {ok
                                      ? produtoBySku.get(draftNorm) || 'No catálogo'
                                      : 'SKU ausente no catálogo'}
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-sm p-2 text-left">
                                    <p className="text-xs leading-relaxed">
                                      {ok
                                        ? produtoBySku.get(draftNorm) || `SKU ${draftNorm} no catálogo`
                                        : `SKU ${draftNorm} não existe em Produtos`}
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                            <button
                              type="button"
                              disabled={!ok || busy || loadingProdutos}
                              onClick={() => void handleVincular(r.sku)}
                              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-input hover:bg-accent disabled:opacity-40"
                              aria-label="Vincular"
                              title="Vincular"
                            >
                              {busy ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Link2 className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <SectionTitle title="Mapeamentos cadastrados" icon={Link2} />
          {loadingMapeados ? (
            <Skeleton className="mt-2 h-24 w-full" />
          ) : mapeados.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              Nenhum vínculo gravado ainda.
            </p>
          ) : (
            <div className="mt-2 max-h-64 overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs">SKU origem</TableHead>
                    <TableHead className="text-xs">SKU catálogo</TableHead>
                    <TableHead className="text-xs">Criado</TableHead>
                    <TableHead className="text-right text-xs">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mapeados.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-mono text-xs">{m.sku_origem}</TableCell>
                      <TableCell className="font-mono text-xs">{m.sku_fornecedor}</TableCell>
                      <TableCell className="text-[11px] text-muted-foreground">
                        {new Date(m.criado_em).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-right">
                        <button
                          type="button"
                          disabled={removendoOrigem === m.sku_origem || remover.isPending}
                          onClick={() => void handleRemover(m.sku_origem)}
                          className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] text-muted-foreground hover:bg-accent hover:text-destructive disabled:opacity-40"
                        >
                          <Trash2 className="h-3 w-3" />
                          Remover
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Wire the section into `AdminProdutos.tsx`**

Add the import at the top of `src/pages/admin/AdminProdutos.tsx`:

```typescript
import { AdminProdutosCuradoria } from './AdminProdutosCuradoria'
```

Change the component's return statement from:

```tsx
  return (
    <div>
      <FilterBar>
```

to:

```tsx
  return (
    <div className="space-y-6">
      <AdminProdutosCuradoria />

      <FilterBar>
```

(The closing `</div>` at the end of the file stays as-is — it now wraps both the new section and the existing catalog table.)

- [ ] **Step 3: Type-check and build**

Run: `npx tsc -b --noEmit`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Manual verification in the browser**

Start the dev server (`npm run dev`), sign in as an admin, open `/admin/produtos`, and confirm:
- A "SKUs não mapeados" card appears above the existing read-only catalog table, listing 7 rows sorted by faturamento descending.
- Typing a SKU that exists in the catalog into the input shows the description in emerald/green and enables the "Vincular" button.
- Typing a SKU that does **not** exist (e.g. a random string, or one of the genuinely-new-product SKUs from the 7 orphans themselves) shows "SKU ausente no catálogo" in amber and keeps the button disabled — this is the expected, correct outcome for today's 7 orphans, not a bug to chase.
- The "Mapeamentos cadastrados" card renders empty ("Nenhum vínculo gravado ainda") since Task 1 created the table empty.
- If a non-admin, non-`gestor_fornecedor` account is available, confirm they cannot reach a state where the "Vincular" button succeeds (RLS blocks the INSERT even if the UI were bypassed) — this can be checked via the Supabase MCP `execute_sql` tool by running the INSERT as that role, or by code review of the Step 1 policy from Task 1 confirming `WITH CHECK` scopes correctly to admin/gestor_fornecedor only.

- [ ] **Step 5: Commit**

```bash
git add src/pages/admin/AdminProdutosCuradoria.tsx src/pages/admin/AdminProdutos.tsx
git commit -m "feat(admin): curadoria de SKU órfão em /admin/produtos"
```
