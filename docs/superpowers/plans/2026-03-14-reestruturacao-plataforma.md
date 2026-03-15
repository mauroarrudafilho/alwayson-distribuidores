# Reestruturação da Plataforma — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the AlwaysOn Distribuidores platform from fragmented pages into a cohesive flow: hierarchical Performance hub, client detail page, excellence scorecard, supply-chain Estoque, and an Admin cockpit — reducing clicks and increasing context per screen.

**Architecture:** Performance becomes the central page with 5 hierarchical tabs (Distribuidor → Gerência → Supervisão → Vendas → Cliente) supporting both direct-filter access and click-through drill-down. Metas are embedded inline. A new Clientes page provides transactional detail per client. Admin cockpit centralizes all configuration. State propagated via URL params + React local state.

**Tech Stack:** React 19, Vite 7, TypeScript, Tailwind 4, Shadcn UI, TanStack Query, Supabase, React Router 7

**Spec:** `docs/superpowers/specs/2026-03-14-reestruturacao-plataforma-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `src/types/index.ts` | Re-exports all types (barrel) |
| `src/types/produto.ts` | Produto interface |
| `src/types/faturamento.ts` | Faturamento, FaturamentoItem interfaces |
| `src/types/excelencia.ts` | ExcelenciaConfig, ExcelenciaCliente interfaces |
| `src/pages/Performance.tsx` | Performance hub page with hierarchical tabs |
| `src/pages/performance/DistribuidorTab.tsx` | Tab: distribuidor-level view |
| `src/pages/performance/GerenciaTab.tsx` | Tab: gerência-level view |
| `src/pages/performance/SupervisaoTab.tsx` | Tab: supervisão-level view |
| `src/pages/performance/VendasTab.tsx` | Tab: vendas-level view |
| `src/pages/performance/ClienteTab.tsx` | Tab: cliente-level view |
| `src/pages/performance/PerformanceContext.tsx` | Context provider for drill-down state |
| `src/pages/performance/usePerfFilters.ts` | Hook: URL params ↔ filter state sync |
| `src/pages/ClientesBusca.tsx` | Client search page (`/clientes`) |
| `src/pages/ClienteDetalhe.tsx` | Client detail page (`/clientes/:id`) |
| `src/pages/Excelencia.tsx` | Rewritten excelência page with scorecard table |
| `src/pages/Admin.tsx` | Admin layout with sub-tabs |
| `src/pages/admin/AdminDistribuidores.tsx` | Sub-tab: distribuidores CRUD |
| `src/pages/admin/AdminProdutos.tsx` | Sub-tab: produtos CRUD |
| `src/pages/admin/AdminMetas.tsx` | Sub-tab: metas config |
| `src/pages/admin/AdminExcelencia.tsx` | Sub-tab: excelência criteria + clients |
| `src/pages/admin/AdminUsuarios.tsx` | Sub-tab: users (placeholder) |
| `src/hooks/usePerformanceHierarchy.ts` | Hook: hierarchical performance data with recursive resolution |
| `src/hooks/useFaturamento.ts` | Hook: faturamento data for client detail |
| `src/hooks/useExcelenciaConfig.ts` | Hook: excelência config + monitoring data |
| `src/hooks/useClientesBusca.ts` | Hook: client search with debounce |
| `src/hooks/useProdutos.ts` | Hook: produtos CRUD |

### Modified Files

| File | Changes |
|------|---------|
| `src/types/distribuidor.ts` | Update EstoqueItem status enum, add `lead_time_dias` to Distribuidor, add `estoque_minimo_calculado` to EstoqueItem |
| `src/App.tsx` | New routes (`/performance`, `/clientes`, `/clientes/:id`, `/admin/*`), remove old routes (`/distribuidores`, `/metas`) |
| `src/components/layout/Sidebar.tsx` | New menu items, separator, reorder |
| `src/hooks/useEstoque.ts` | Updated for new status enum |
| `src/hooks/useMetas.ts` | Renamed/adapted for use within performance |
| `src/hooks/useDashboardKPIs.ts` | Update estoque status filter |
| `src/pages/EstoquePanel.tsx` | Add Est. Mínimo column, período de referência filter, S&OP logic |
| `src/pages/IngestaoPanel.tsx` | Add template download button |
| `src/components/distribuidor/StatusBadge.tsx` | Add new status types (saudavel, overstock) |

### Deleted Files

| File | Reason |
|------|--------|
| `src/pages/DistribuidoresList.tsx` | Migrated to Admin |
| `src/pages/DistribuidorDetail.tsx` | Functionality split into Performance tabs + Admin |
| `src/pages/MetasPanel.tsx` | Absorbed into Performance |
| `src/pages/PerformanceList.tsx` | Replaced by new Performance.tsx |
| `src/pages/ExcelenciaList.tsx` | Replaced by new Excelencia.tsx |

---

## Chunk 1: Foundation — Types, Schema, Navigation

### Task 1: Update Types

**Files:**
- Modify: `src/types/distribuidor.ts`
- Create: `src/types/produto.ts`
- Create: `src/types/nota-fiscal.ts`
- Create: `src/types/excelencia.ts`

- [ ] **Step 1: Update EstoqueItem and Distribuidor types**

In `src/types/distribuidor.ts`, change `EstoqueItem.status` and add fields:

```typescript
// In EstoqueItem interface:
export interface EstoqueItem {
  id: string
  distribuidor_id: string
  sku: string
  descricao: string
  quantidade_atual: number
  quantidade_minima: number
  estoque_minimo_calculado?: number
  dias_cobertura: number
  status: 'saudavel' | 'critico' | 'overstock'
  ultima_atualizacao: string
  sugestao_pedido?: number
}

// In Distribuidor interface, add:
//   lead_time_dias?: number
```

- [ ] **Step 2: Create `src/types/produto.ts`**

```typescript
export interface Produto {
  id: string
  sku: string
  descricao: string
  categoria?: string
  preco_referencia?: number
  ativo: boolean
  criado_em: string
}
```

- [ ] **Step 3: Create `src/types/faturamento.ts`**

```typescript
export interface Faturamento {
  id: string
  distribuidor_id: string
  cliente_id: string
  vendedor_id: string
  numero_nf: string
  data_emissao: string
  valor_total: number
  criado_em: string
}

export interface FaturamentoItem {
  id: string
  faturamento_id: string
  produto_id?: string
  sku: string
  descricao: string
  quantidade: number
  valor_unitario: number
  valor_total: number
}
```

- [ ] **Step 4: Create `src/types/excelencia.ts`**

```typescript
export interface ExcelenciaConfig {
  id: string
  distribuidor_id: string
  criterio_nome: string
  meta_valor: number
  tipo_comparacao: 'min' | 'max'
  ativo: boolean
  ordem: number
  criado_em: string
}

export interface ExcelenciaCliente {
  id: string
  distribuidor_id: string
  cliente_id: string
  ativo: boolean
  adicionado_em: string
}

export interface ExcelenciaMonitorRow {
  cliente_id: string
  cliente_nome: string
  cnpj: string
  criterios: {
    criterio_nome: string
    meta: number
    realizado: number
    status: 'verde' | 'amarelo' | 'vermelho'
  }[]
  score: number
}
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors from new type files

- [ ] **Step 6: Commit**

```bash
git add src/types/
git commit -m "feat: add new types for produtos, notas fiscais, excelência config"
```

---

### Task 2: Update Sidebar Navigation

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Update menu items and add separator**

Replace the `menuItems` array and add separator logic in `Sidebar.tsx`:

```typescript
import {
  LayoutDashboard,
  TrendingUp,
  Award,
  UserSearch,
  Package,
  Settings,
  Upload,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

const menuItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard, group: 'operacional' },
  { path: '/performance', label: 'Performance', icon: TrendingUp, group: 'operacional' },
  { path: '/excelencia', label: 'Excelência', icon: Award, group: 'operacional' },
  { path: '/clientes', label: 'Clientes', icon: UserSearch, group: 'operacional' },
  { path: '/estoque', label: 'Estoque', icon: Package, group: 'operacional' },
  { path: '/admin', label: 'Administração', icon: Settings, group: 'admin' },
  { path: '/ingestao', label: 'Ingestão', icon: Upload, group: 'admin' },
]
```

In the `<nav>` section, add a separator `<div>` between groups:

```tsx
<nav className="flex-1 px-2 py-2 space-y-0.5">
  {menuItems.map((item, idx) => {
    const prevGroup = idx > 0 ? menuItems[idx - 1].group : item.group
    const showSeparator = item.group !== prevGroup

    const isActive =
      item.path === '/'
        ? location.pathname === '/'
        : location.pathname.startsWith(item.path)

    return (
      <div key={item.path}>
        {showSeparator && (
          <div className="my-2 mx-2 border-t border-border/50" />
        )}
        {/* existing Link markup, unchanged */}
      </div>
    )
  })}
</nav>
```

- [ ] **Step 2: Verify sidebar renders correctly**

Run: `npm run dev`
Verify: Sidebar shows 7 items with separator between Estoque and Administração

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/Sidebar.tsx
git commit -m "feat: update sidebar navigation with new items and admin separator"
```

---

### Task 3: Update Routes

**Files:**
- Modify: `src/App.tsx`
- Create: `src/pages/Performance.tsx` (placeholder)
- Create: `src/pages/ClientesBusca.tsx` (placeholder)
- Create: `src/pages/ClienteDetalhe.tsx` (placeholder)
- Create: `src/pages/Excelencia.tsx` (placeholder)
- Create: `src/pages/Admin.tsx` (placeholder)
- Create: `src/pages/admin/AdminDistribuidores.tsx` (placeholder)

- [ ] **Step 1: Create placeholder pages**

Each placeholder page follows this pattern (adapt title/description):

```typescript
// src/pages/Performance.tsx
import { PageHeader } from '@/components/distribuidor/PageHeader'

export function Performance() {
  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Performance"
        description="Análise de sell-out por profundidade hierárquica"
      />
      <p className="text-sm text-muted-foreground">Em construção...</p>
    </div>
  )
}
```

Create similarly for: `ClientesBusca.tsx` ("Clientes" / "Consulta detalhada por cliente"), `ClienteDetalhe.tsx` ("Detalhe do Cliente"), `Excelencia.tsx` ("Excelência" / "Monitoramento de clientes estratégicos"), `Admin.tsx` ("Administração" / "Cockpit de Parâmetros").

For `Admin.tsx`, include nested Outlet:
```typescript
import { Outlet, Navigate, useLocation } from 'react-router-dom'
import { PageHeader } from '@/components/distribuidor/PageHeader'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Link } from 'react-router-dom'

const adminTabs = [
  { path: '/admin/distribuidores', label: 'Distribuidores' },
  { path: '/admin/produtos', label: 'Produtos' },
  { path: '/admin/metas', label: 'Metas' },
  { path: '/admin/excelencia', label: 'Excelência' },
  { path: '/admin/usuarios', label: 'Usuários' },
]

export function Admin() {
  const location = useLocation()

  if (location.pathname === '/admin') {
    return <Navigate to="/admin/distribuidores" replace />
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Administração"
        description="Cockpit de Parâmetros"
      />
      <div className="flex gap-1 border-b border-border/50 mb-6">
        {adminTabs.map((tab) => (
          <Link
            key={tab.path}
            to={tab.path}
            className={`px-3 py-2 text-sm transition-colors border-b-2 ${
              location.pathname === tab.path
                ? 'border-primary text-foreground font-medium'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>
      <Outlet />
    </div>
  )
}
```

Create `src/pages/admin/AdminDistribuidores.tsx` as a placeholder that renders "Em construção...".

- [ ] **Step 2: Update `src/App.tsx` routes**

```typescript
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AppLayout } from '@/components/layout/AppLayout'
import { Dashboard } from '@/pages/Dashboard'
import { Performance } from '@/pages/Performance'
import { Excelencia } from '@/pages/Excelencia'
import { ClientesBusca } from '@/pages/ClientesBusca'
import { ClienteDetalhe } from '@/pages/ClienteDetalhe'
import { EstoquePanel } from '@/pages/EstoquePanel'
import { Admin } from '@/pages/Admin'
import { AdminDistribuidores } from '@/pages/admin/AdminDistribuidores'
import { IngestaoPanel } from '@/pages/IngestaoPanel'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/performance" element={<Performance />} />
              <Route path="/excelencia" element={<Excelencia />} />
              <Route path="/clientes" element={<ClientesBusca />} />
              <Route path="/clientes/:id" element={<ClienteDetalhe />} />
              <Route path="/estoque" element={<EstoquePanel />} />
              <Route path="/admin" element={<Admin />}>
                <Route index element={<Navigate to="/admin/distribuidores" replace />} />
                <Route path="distribuidores" element={<AdminDistribuidores />} />
              </Route>
              <Route path="/ingestao" element={<IngestaoPanel />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  )
}

export default App
```

- [ ] **Step 3: Verify app compiles and all routes work**

Run: `npx tsc --noEmit && npm run dev`
Verify: Navigate to each route — all show placeholder content. Old routes (/distribuidores, /metas) are gone.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/pages/
git commit -m "feat: restructure routes — add Performance, Clientes, Admin; remove Distribuidores, Metas"
```

---

## Chunk 2: Performance Hub

### Task 4: Performance Context & URL Sync

**Files:**
- Create: `src/pages/performance/PerformanceContext.tsx`
- Create: `src/pages/performance/usePerfFilters.ts`

- [ ] **Step 1: Create Performance context**

`src/pages/performance/PerformanceContext.tsx`:

```typescript
import { createContext, useContext, type ReactNode } from 'react'
import { usePerfFilters, type PerfFilters } from './usePerfFilters'

interface PerformanceContextValue {
  filters: PerfFilters
  setFilter: (key: keyof PerfFilters, value: string | undefined) => void
  drillDown: (level: PerfFilters['tab'], filters: Partial<PerfFilters>) => void
  breadcrumbs: { label: string; tab: PerfFilters['tab']; filters: Partial<PerfFilters> }[]
  availableTabs: PerfFilters['tab'][]
  setAvailableTabs: (tabs: PerfFilters['tab'][]) => void
}

const Ctx = createContext<PerformanceContextValue | null>(null)

export function usePerformanceContext() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('usePerformanceContext must be used within PerformanceProvider')
  return ctx
}

export function PerformanceProvider({ children }: { children: ReactNode }) {
  // Implementation will use usePerfFilters hook
  // and derive breadcrumbs from current filter state
  // ... (full implementation in step)
}
```

- [ ] **Step 2: Create URL sync hook**

`src/pages/performance/usePerfFilters.ts`:

```typescript
import { useSearchParams } from 'react-router-dom'
import { useCallback } from 'react'

export type PerfTab = 'distribuidor' | 'gerencia' | 'supervisao' | 'vendas' | 'cliente'

export interface PerfFilters {
  tab: PerfTab
  distribuidorId?: string
  gerenteId?: string
  supervisorId?: string
  vendedorId?: string
  periodoInicio?: string
  periodoFim?: string
}

const TAB_PARAM = 'tab'
const PARAM_MAP: Record<string, keyof PerfFilters> = {
  distribuidor: 'distribuidorId',
  gerente: 'gerenteId',
  supervisor: 'supervisorId',
  vendedor: 'vendedorId',
  periodo_inicio: 'periodoInicio',
  periodo_fim: 'periodoFim',
}

export function usePerfFilters() {
  const [searchParams, setSearchParams] = useSearchParams()

  const filters: PerfFilters = {
    tab: (searchParams.get(TAB_PARAM) as PerfTab) || 'distribuidor',
    distribuidorId: searchParams.get('distribuidor') || undefined,
    gerenteId: searchParams.get('gerente') || undefined,
    supervisorId: searchParams.get('supervisor') || undefined,
    vendedorId: searchParams.get('vendedor') || undefined,
    periodoInicio: searchParams.get('periodo_inicio') || undefined,
    periodoFim: searchParams.get('periodo_fim') || undefined,
  }

  const setFilter = useCallback(
    (key: keyof PerfFilters, value: string | undefined) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        const paramName = Object.entries(PARAM_MAP).find(([, v]) => v === key)?.[0] ?? key
        if (value) {
          next.set(paramName, value)
        } else {
          next.delete(paramName)
        }
        return next
      })
    },
    [setSearchParams]
  )

  const drillDown = useCallback(
    (tab: PerfTab, newFilters: Partial<PerfFilters>) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        next.set(TAB_PARAM, tab)
        for (const [key, value] of Object.entries(newFilters)) {
          if (key === 'tab') continue
          const paramName = Object.entries(PARAM_MAP).find(([, v]) => v === key)?.[0] ?? key
          if (value) next.set(paramName, value as string)
        }
        return next
      })
    },
    [setSearchParams]
  )

  return { filters, setFilter, drillDown }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/pages/performance/
git commit -m "feat: add Performance context and URL filter sync hook"
```

---

### Task 5: Performance Hierarchy Data Hook

**Files:**
- Create: `src/hooks/usePerformanceHierarchy.ts`

- [ ] **Step 1: Create the hierarchy hook**

This hook fetches vendedores and resolves the hierarchy tree, then provides aggregation helpers:

```typescript
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Vendedor, PerformancePeriodo, Meta } from '@/types/distribuidor'

interface HierarchyNode extends Vendedor {
  subordinados: string[]
}

export function useVendedorHierarchy(distribuidorId: string | undefined) {
  return useQuery({
    queryKey: ['vendedor-hierarchy', distribuidorId],
    queryFn: async () => {
      if (!distribuidorId) throw new Error('distribuidorId required')
      const { data, error } = await supabase
        .from('alwayson_vendedores_distribuidor')
        .select('*')
        .eq('distribuidor_id', distribuidorId)
        .eq('ativo', true)
      if (error) throw error

      const vendedores = data as Vendedor[]
      const gerentes = vendedores.filter((v) => v.tipo === 'gerente')
      const supervisores = vendedores.filter((v) => v.tipo === 'supervisor')
      const vendedoresOnly = vendedores.filter((v) => v.tipo === 'vendedor')

      const availableLevels: string[] = ['distribuidor']
      if (gerentes.length > 0) availableLevels.push('gerencia')
      if (supervisores.length > 0) availableLevels.push('supervisao')
      availableLevels.push('vendas', 'cliente')

      // Build subordination map
      function getSubordinateIds(parentId: string): string[] {
        const directs = vendedores.filter((v) => v.supervisor_id === parentId)
        return directs.flatMap((d) => [d.id, ...getSubordinateIds(d.id)])
      }

      return {
        vendedores,
        gerentes,
        supervisores,
        vendedoresOnly,
        availableLevels,
        getSubordinateIds,
      }
    },
    enabled: !!distribuidorId,
  })
}

export function usePerformanceByLevel(
  distribuidorId: string | undefined,
  periodoInicio?: string,
  periodoFim?: string
) {
  return useQuery({
    queryKey: ['performance-level', distribuidorId, periodoInicio, periodoFim],
    queryFn: async () => {
      if (!distribuidorId) throw new Error('distribuidorId required')
      let query = supabase
        .from('alwayson_performance_periodo')
        .select('*')
        .eq('distribuidor_id', distribuidorId)

      if (periodoInicio) query = query.gte('periodo_inicio', periodoInicio)
      if (periodoFim) query = query.lte('periodo_fim', periodoFim)

      const { data, error } = await query
      if (error) throw error
      return data as PerformancePeriodo[]
    },
    enabled: !!distribuidorId,
  })
}

export function useMetasByLevel(
  distribuidorId: string | undefined,
  hierarquia?: Meta['hierarquia'],
  vendedorId?: string
) {
  return useQuery({
    queryKey: ['metas-level', distribuidorId, hierarquia, vendedorId],
    queryFn: async () => {
      let query = supabase
        .from('alwayson_metas_distribuidor')
        .select('*')
        .order('periodo_inicio', { ascending: false })

      if (distribuidorId) query = query.eq('distribuidor_id', distribuidorId)
      if (hierarquia) query = query.eq('hierarquia', hierarquia)
      if (vendedorId) query = query.eq('vendedor_id', vendedorId)

      const { data, error } = await query
      if (error) throw error
      return data as Meta[]
    },
    enabled: !!distribuidorId,
  })
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/hooks/usePerformanceHierarchy.ts
git commit -m "feat: add hierarchy resolution and performance-by-level hooks"
```

---

### Task 6: Performance Page — Main Shell + Distribuidor Tab

**Files:**
- Modify: `src/pages/Performance.tsx` (replace placeholder)
- Create: `src/pages/performance/DistribuidorTab.tsx`

- [ ] **Step 1: Build the Performance shell with tabs**

Replace `src/pages/Performance.tsx` with full implementation:
- PageHeader
- Global filters (distribuidor select, período range)
- Tabs bar (dynamically shows only available levels)
- Breadcrumb trail below tabs
- Renders active tab component
- Uses PerformanceContext provider

The page should:
1. Fetch distribuidores list for the filter dropdown
2. When a distribuidor is selected, fetch the hierarchy to determine available tabs
3. Render the active tab based on URL params
4. Show breadcrumb for drill-down path

- [ ] **Step 2: Build DistribuidorTab**

`src/pages/performance/DistribuidorTab.tsx`:
- KPI grid: Faturamento, Positivação, Itens, Meta vs Realizado (with progress bar)
- Table: all distribuidores with aggregated metrics per distribuidor
- Each row clickable → drillDown('gerencia', { distribuidorId: row.id })
- Uses `useAllPerformance()` and `useDistribuidores()` for data

- [ ] **Step 3: Verify tab renders with real data**

Run: `npm run dev`
Navigate to `/performance` — should show Distribuidor tab with KPIs and table.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Performance.tsx src/pages/performance/
git commit -m "feat: build Performance shell with distribuidor tab and drill-down"
```

---

### Task 7: Performance — Gerência, Supervisão, Vendas Tabs

**Files:**
- Create: `src/pages/performance/GerenciaTab.tsx`
- Create: `src/pages/performance/SupervisaoTab.tsx`
- Create: `src/pages/performance/VendasTab.tsx`

- [ ] **Step 1: Build GerenciaTab**

Shows gerentes of the selected distribuidor. For each gerente, aggregates performance of all subordinates (via `getSubordinateIds`). KPIs scoped to distribuidor. Meta inline per gerente. Click → drillDown('supervisao', { gerenteId }).

- [ ] **Step 2: Build SupervisaoTab**

Shows supervisores filtered by selected gerente (if any). Aggregates performance of direct-report vendedores. Additional filter: gerente dropdown. Click → drillDown('vendas', { supervisorId }).

- [ ] **Step 3: Build VendasTab**

Shows individual vendedores filtered by supervisor (if any). Performance is direct (no aggregation needed). Additional filters: gerente, supervisor dropdowns. Click → drillDown('cliente', { vendedorId }).

- [ ] **Step 4: Verify all tabs work with drill-down navigation**

Run: `npm run dev`
Test: Click distribuidor → gerência populates → click gerente → supervisão populates → click supervisor → vendas populates. Breadcrumb updates. Tabs can also be accessed directly with manual filter selection.

- [ ] **Step 5: Commit**

```bash
git add src/pages/performance/
git commit -m "feat: add Gerência, Supervisão, Vendas tabs with drill-down"
```

---

### Task 8: Performance — Cliente Tab

**Files:**
- Create: `src/pages/performance/ClienteTab.tsx`

- [ ] **Step 1: Build ClienteTab**

Shows clients of the selected vendedor (or all clients for the distribuidor if no vendedor filter). Columns: Nome, CNPJ, Cidade, Faturamento (from NFs or performance data), Última Compra, Status. Click → navigate to `/clientes/:id`.

Additional filters: gerente, supervisor, vendedor dropdowns.

- [ ] **Step 2: Verify tab works and navigates to client detail**

Run: `npm run dev`
Test: Navigate to Cliente tab via drill-down, click a client row → navigates to `/clientes/:id`.

- [ ] **Step 3: Commit**

```bash
git add src/pages/performance/ClienteTab.tsx
git commit -m "feat: add Cliente tab with navigation to client detail"
```

---

## Chunk 3: Clientes

### Task 9: Client Search Page

**Files:**
- Create: `src/hooks/useClientesBusca.ts`
- Modify: `src/pages/ClientesBusca.tsx` (replace placeholder)

- [ ] **Step 1: Create search hook with debounce**

`src/hooks/useClientesBusca.ts`:

```typescript
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { ClienteDistribuidor } from '@/types/distribuidor'

export function useClientesBusca(search: string) {
  return useQuery({
    queryKey: ['clientes-busca', search],
    queryFn: async () => {
      const term = `%${search}%`
      const { data, error } = await supabase
        .from('alwayson_clientes_distribuidor')
        .select('*')
        .or(`cnpj.ilike.${term},razao_social.ilike.${term},nome_fantasia.ilike.${term}`)
        .order('razao_social')
        .limit(50)
      if (error) throw error
      return data as ClienteDistribuidor[]
    },
    enabled: search.length >= 3,
  })
}
```

- [ ] **Step 2: Build search page**

Replace `src/pages/ClientesBusca.tsx`:
- PageHeader
- Search input with debounce (300ms) — use `useState` + `useEffect` for debounce
- Results table: Nome Fantasia, Razão Social, CNPJ, Cidade
- Rows clickable → `/clientes/:id`
- Empty state when no search or no results
- Minimum 3 characters message

- [ ] **Step 3: Verify search works**

Run: `npm run dev`
Navigate to `/clientes`, type a CNPJ or name — results appear after 3 chars.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useClientesBusca.ts src/pages/ClientesBusca.tsx
git commit -m "feat: add client search page with debounced CNPJ/name lookup"
```

---

### Task 10: Client Detail Page

**Files:**
- Create: `src/hooks/useFaturamento.ts`
- Modify: `src/pages/ClienteDetalhe.tsx` (replace placeholder)

- [ ] **Step 1: Create faturamento hooks**

`src/hooks/useFaturamento.ts`:

```typescript
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Faturamento, FaturamentoItem } from '@/types/faturamento'

export function useFaturamento(clienteId: string | undefined) {
  return useQuery({
    queryKey: ['faturamento', clienteId],
    queryFn: async () => {
      if (!clienteId) throw new Error('clienteId required')
      const { data, error } = await supabase
        .from('alwayson_faturamento')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('data_emissao', { ascending: false })
      if (error) throw error
      return data as Faturamento[]
    },
    enabled: !!clienteId,
  })
}

export function useFaturamentoItens(faturamentoId: string | undefined) {
  return useQuery({
    queryKey: ['faturamento-itens', faturamentoId],
    queryFn: async () => {
      if (!faturamentoId) throw new Error('faturamentoId required')
      const { data, error } = await supabase
        .from('alwayson_faturamento_itens')
        .select('*')
        .eq('faturamento_id', faturamentoId)
        .order('sku')
      if (error) throw error
      return data as FaturamentoItem[]
    },
    enabled: !!faturamentoId,
  })
}

export function useClienteFaturamentoMensal(clienteId: string | undefined) {
  return useQuery({
    queryKey: ['cliente-faturamento-mensal', clienteId],
    queryFn: async () => {
      if (!clienteId) throw new Error('clienteId required')
      const { data, error } = await supabase
        .from('alwayson_faturamento')
        .select('data_emissao, valor_total')
        .eq('cliente_id', clienteId)
        .order('data_emissao')
      if (error) throw error

      // Aggregate by month client-side
      const monthly = new Map<string, number>()
      for (const row of data ?? []) {
        const month = row.data_emissao.substring(0, 7) // YYYY-MM
        monthly.set(month, (monthly.get(month) ?? 0) + Number(row.valor_total))
      }

      return Array.from(monthly.entries())
        .map(([month, total]) => ({ month, total }))
        .sort((a, b) => a.month.localeCompare(b.month))
    },
    enabled: !!clienteId,
  })
}
```

- [ ] **Step 2: Build client detail page**

Replace `src/pages/ClienteDetalhe.tsx`:
- Back button (← Voltar)
- Header: nome, CNPJ, cidade-UF, vendedor, distribuidor
- KPI grid: Faturamento total, Ticket médio, Frequência de compra (NFs/mês), Última compra
- Evolução de Faturamento: line chart (use a simple CSS bar chart or Recharts if available)
- Histórico de Faturamento: table (Data, Nº NF, Itens, Valor), expandable rows showing items
- Produtos Mais Comprados: ranking table from faturamento items aggregation

- [ ] **Step 3: Verify detail page renders with client data**

Run: `npm run dev`
Navigate to `/clientes/:id` — shows client info, KPIs, faturamento history.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useFaturamento.ts src/pages/ClienteDetalhe.tsx
git commit -m "feat: add client detail page with faturamento history, KPIs, and product ranking"
```

---

## Chunk 4: Excelência Rewrite

### Task 11: Excelência Config Hook

**Files:**
- Create: `src/hooks/useExcelenciaConfig.ts`

- [ ] **Step 1: Create excelência hooks**

```typescript
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { ExcelenciaConfig, ExcelenciaCliente } from '@/types/excelencia'
import type { ClienteDistribuidor } from '@/types/distribuidor'

export function useExcelenciaConfigs(distribuidorId?: string) {
  return useQuery({
    queryKey: ['excelencia-config', distribuidorId ?? 'all'],
    queryFn: async () => {
      let query = supabase
        .from('alwayson_excelencia_config')
        .select('*')
        .eq('ativo', true)
        .order('ordem')
      if (distribuidorId) query = query.eq('distribuidor_id', distribuidorId)
      const { data, error } = await query
      if (error) throw error
      return data as ExcelenciaConfig[]
    },
  })
}

export function useExcelenciaClientes(distribuidorId?: string) {
  return useQuery({
    queryKey: ['excelencia-clientes', distribuidorId ?? 'all'],
    queryFn: async () => {
      let query = supabase
        .from('alwayson_excelencia_clientes')
        .select(`
          *,
          cliente:alwayson_clientes_distribuidor(*)
        `)
        .eq('ativo', true)
      if (distribuidorId) query = query.eq('distribuidor_id', distribuidorId)
      const { data, error } = await query
      if (error) throw error
      return data as (ExcelenciaCliente & { cliente: ClienteDistribuidor })[]
    },
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useExcelenciaConfig.ts
git commit -m "feat: add excelência config and monitoring hooks"
```

---

### Task 12: Excelência Page Rewrite

**Files:**
- Modify: `src/pages/Excelencia.tsx` (replace placeholder)

- [ ] **Step 1: Build the excelência scorecard table page**

Replace `src/pages/Excelencia.tsx`:
- PageHeader
- Filters: Distribuidor, Status (Todos/Aderentes/Em risco/Fora do padrão)
- KPI grid: Total clientes, Aderência 100%, Em risco, Fora do padrão
- Table with dynamic criterion columns:
  - First column: Cliente name (clickable → `/clientes/:id`)
  - Middle columns: one per criterion from `useExcelenciaConfigs` — cell shows realizado value with background color (green/yellow/red based on thresholds)
  - Last column: Score (%)
- Sortable by any column
- Status color logic: verde (≥ meta), amarelo (≥ 70% meta), vermelho (< 70% meta)
- Score = (critérios atingidos / total) × 100

For now, the "realizado" values per criterion will use placeholder data from `alwayson_clientes_distribuidor` fields (itens_cadastrados, frequencia_compra_dias, etc.). Full NF-based calculation will come when NF data is ingested.

- [ ] **Step 2: Verify excelência page renders**

Run: `npm run dev`
Navigate to `/excelencia` — shows scorecard table with criterion columns.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Excelencia.tsx
git commit -m "feat: rewrite Excelência with dynamic scorecard table and color-coded criteria"
```

---

## Chunk 5: Estoque, Admin, Ingestão, Dashboard

### Task 13: Estoque Improvements

**Files:**
- Modify: `src/types/distribuidor.ts` (already done in Task 1)
- Modify: `src/hooks/useEstoque.ts`
- Modify: `src/pages/EstoquePanel.tsx`
- Modify: `src/components/distribuidor/StatusBadge.tsx`

- [ ] **Step 1: Update StatusBadge with new statuses**

Add cases for `saudavel`, `overstock` in `StatusBadge.tsx`:
- `saudavel` → green badge "Saudável"
- `critico` → red badge "Crítico" (already exists)
- `overstock` → yellow/amber badge "Overstock"

- [ ] **Step 2: Add período de referência filter to EstoquePanel**

Add a date range picker (month selector) above the table. The selected period is passed to the S&OP suggestion calculation display.

- [ ] **Step 3: Add Est. Mínimo column to table**

Add column "Est. Mín." between "Quantidade" and "Dias Cobertura", showing `estoque_minimo_calculado ?? quantidade_minima`.

- [ ] **Step 4: Update KPI labels**

Change from "Normal/Baixo/Crítico-Ruptura" to "Saudável/Crítico/Overstock".

- [ ] **Step 5: Verify estoque page works**

Run: `npm run dev`
Navigate to `/estoque` — shows new columns, statuses, and período filter.

- [ ] **Step 6: Commit**

```bash
git add src/components/distribuidor/StatusBadge.tsx src/hooks/useEstoque.ts src/pages/EstoquePanel.tsx
git commit -m "feat: upgrade Estoque with dynamic minimum, período filter, and S&OP statuses"
```

---

### Task 14: Admin — Distribuidores Sub-tab

**Files:**
- Modify: `src/pages/admin/AdminDistribuidores.tsx` (replace placeholder)

- [ ] **Step 1: Migrate DistribuidoresList content into AdminDistribuidores**

Copy the table/filter logic from the old `DistribuidoresList.tsx` into `AdminDistribuidores.tsx`, removing the PageHeader (Admin.tsx already provides it). Keep CRUD functionality (list, search, filters).

- [ ] **Step 2: Verify admin distribuidores works**

Run: `npm run dev`
Navigate to `/admin/distribuidores` — shows distribuidores list with filters.

- [ ] **Step 3: Commit**

```bash
git add src/pages/admin/AdminDistribuidores.tsx
git commit -m "feat: migrate distribuidores CRUD to Admin sub-tab"
```

---

### Task 15: Admin — Remaining Sub-tabs (Placeholders)

**Files:**
- Create: `src/pages/admin/AdminProdutos.tsx`
- Create: `src/pages/admin/AdminMetas.tsx`
- Create: `src/pages/admin/AdminExcelencia.tsx`
- Create: `src/pages/admin/AdminUsuarios.tsx`
- Modify: `src/App.tsx` (add sub-routes)

- [ ] **Step 1: Create placeholder sub-tab pages**

Each shows a relevant empty state with icon and description of what will go there:
- AdminProdutos: "Cadastro de produtos do portfólio (em breve)"
- AdminMetas: "Configuração de metas por hierarquia (em breve)"
- AdminExcelencia: "Critérios do plano de excelência (em breve)"
- AdminUsuarios: "Gestão de acessos ao sistema (em breve)"

- [ ] **Step 2: Add routes in App.tsx**

```typescript
import { AdminProdutos } from '@/pages/admin/AdminProdutos'
import { AdminMetas } from '@/pages/admin/AdminMetas'
import { AdminExcelencia } from '@/pages/admin/AdminExcelencia'
import { AdminUsuarios } from '@/pages/admin/AdminUsuarios'

// Inside <Route path="/admin" element={<Admin />}>:
<Route path="produtos" element={<AdminProdutos />} />
<Route path="metas" element={<AdminMetas />} />
<Route path="excelencia" element={<AdminExcelencia />} />
<Route path="usuarios" element={<AdminUsuarios />} />
```

- [ ] **Step 3: Verify all admin sub-tabs navigate correctly**

Run: `npm run dev`
Navigate to each `/admin/*` route — all render their placeholder content.

- [ ] **Step 4: Commit**

```bash
git add src/pages/admin/ src/App.tsx
git commit -m "feat: add Admin sub-tab placeholders for Produtos, Metas, Excelência, Usuários"
```

---

### Task 16: Ingestão — Template Download

**Files:**
- Modify: `src/pages/IngestaoPanel.tsx`
- Modify: `src/components/distribuidor/IngestaoUpload.tsx`

- [ ] **Step 1: Add template download button**

In `IngestaoUpload.tsx` (or `IngestaoPanel.tsx` depending on where the type selector is), add a "Baixar Template" button next to the upload button. The button links to the template file based on selected type:
- vendas → `/templates/template-vendas.xlsx`
- estoque → `/templates/template-estoque.xlsx`
- clientes → `/templates/template-clientes.xlsx`

- [ ] **Step 2: Copy templates to `public/templates/`**

```bash
mkdir -p public/templates
cp docs/templates/*.xlsx public/templates/ 2>/dev/null || echo "Templates will be added manually"
```

- [ ] **Step 3: Verify download works**

Run: `npm run dev`
Click "Baixar Template" — file downloads.

- [ ] **Step 4: Commit**

```bash
git add src/pages/IngestaoPanel.tsx src/components/distribuidor/IngestaoUpload.tsx public/templates/
git commit -m "feat: add template download button to Ingestão page"
```

---

### Task 17: Dashboard — Fix Estoque Query

**Files:**
- Modify: `src/hooks/useDashboardKPIs.ts`

- [ ] **Step 1: Update estoque status filter**

In `useDashboardKPIs.ts`, change:
```typescript
// FROM:
.in('status', ['critico', 'ruptura'])
// TO:
.in('status', ['critico'])
```

- [ ] **Step 2: Verify dashboard loads without errors**

Run: `npm run dev`
Navigate to `/` — dashboard KPIs render correctly.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useDashboardKPIs.ts
git commit -m "fix: update dashboard estoque query for new status enum"
```

---

### Task 18: Cleanup — Remove Old Files

**Files:**
- Delete: `src/pages/DistribuidoresList.tsx`
- Delete: `src/pages/DistribuidorDetail.tsx`
- Delete: `src/pages/MetasPanel.tsx`
- Delete: `src/pages/PerformanceList.tsx`
- Delete: `src/pages/ExcelenciaList.tsx`

- [ ] **Step 1: Delete old page files**

```bash
rm src/pages/DistribuidoresList.tsx
rm src/pages/DistribuidorDetail.tsx
rm src/pages/MetasPanel.tsx
rm src/pages/PerformanceList.tsx
rm src/pages/ExcelenciaList.tsx
```

- [ ] **Step 2: Verify no import errors remain**

Run: `npx tsc --noEmit`
Expected: No errors (all imports were already updated in Task 3)

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove deprecated pages (DistribuidoresList, DistribuidorDetail, MetasPanel, PerformanceList, ExcelenciaList)"
```

---

### Task 19: Final Verification

- [ ] **Step 1: Full TypeScript check**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 2: Full app smoke test**

Run: `npm run dev`
Verify each route:
- `/` — Dashboard loads
- `/performance` — Performance with tabs, drill-down works
- `/excelencia` — Scorecard table renders
- `/clientes` — Search works, results clickable
- `/clientes/:id` — Detail page with KPIs, NF history
- `/estoque` — New columns, statuses, período filter
- `/admin` → redirects to `/admin/distribuidores`
- `/admin/distribuidores` — Distribuidores list
- `/admin/produtos` — Placeholder
- `/admin/metas` — Placeholder
- `/admin/excelencia` — Placeholder
- `/admin/usuarios` — Placeholder
- `/ingestao` — Template download works

- [ ] **Step 3: Build check**

Run: `npm run build`
Expected: Builds successfully with no errors

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete platform restructuring — all routes verified"
```
