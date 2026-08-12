# SKUs Não Mapeados por Distribuidor + Autocomplete de SKU Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each distribuidor's own "Correlação de Produtos" screen a "SKUs não mapeados" queue (same mapeados/não-mapeados split already shipped for the global fornecedor de-para), scoped to that distribuidor's own raw ERP codes — and add a `<datalist>` autocomplete (Código + Nome) to both the new and the existing SKU-link inputs.

**Architecture:** A new view mirrors the shape of the global pending-SKU view already in production (`alwayson_faturamento_v_produtos_nao_mapeados`, migration 069), but grouped by `distribuidor_id` and anti-joined against `alwayson_distribuidor_produto_de_para` (the *distributor's own* de-para, migration 009) instead of the global fornecedor de-para. A new hook reads it; the existing `useUpsertDistribuidorProdutoDePara` mutation (already live, already used by the bulk-upload flow) is reused unmodified for the manual single-row link action. Bundled as a prerequisite: the write RLS on `alwayson_distribuidor_produto_de_para` is currently `USING(true) WITH CHECK(true)` — open to any authenticated user for any distribuidor, a known-but-never-fixed gap from migration 019/043 — and gets scoped to the established `current_user_distribuidor_escopo_ok()` pattern (migration 061) before this plan ships an easier way to write to that table.

**Tech Stack:** React 19 + TypeScript + TanStack Query + Supabase (Postgres/RLS/PostgREST), following the exact file patterns already shipped in `src/pages/admin/AdminProdutosCuradoria.tsx` (this session, migration 069) and `src/pages/admin/AdminInsightsDeParaProdutos.tsx` (existing precedent for the `<datalist>` autocomplete).

## Global Constraints

- Supabase project ref **`osukbalwykbqvoumddxz`** — never the legacy `kgzybpelluftexrewyke`.
- The new view must be created `WITH (security_invoker = true)`.
- The RLS fix on `alwayson_distribuidor_produto_de_para` must use the established `current_user_distribuidor_escopo_ok(uuid)` helper (already defined in migration `061_kam_escrita_operacional_escopo.sql`) — do not invent a new helper function; this table's write access should follow exactly the same pattern as `alwayson_clientes_distribuidor`, `alwayson_clientes_ajustes_cadastro`, etc. in that same migration.
- Never expose a raw UUID in the UI.
- **This is a data-fixing tool, not a catalog-creation tool** — `sku_fornecedor` in `alwayson_distribuidor_produto_de_para` is `REFERENCES alwayson_produtos(sku)` (already enforced by the existing table, migration 009) — the UI must keep validating the typed SKU against the real catalog before allowing "Vincular" (same green/amber real-time pattern already shipped).
- No test framework exists in this repo — verification per task is `npx tsc -b --noEmit`, `npm run build`, SQL cross-checks via the Supabase MCP tools, and — for UI tasks — manual check with `npm run dev` in the browser (accepted limitation from the prior plan: full interactive verification needs an authenticated session only the user has; substitute Supabase MCP `execute_sql` checks where that's not available).
- Migrations are saved to `docs/migrations/<NNN>_<name>.sql` (next available number: `072`) **and** applied live via the Supabase MCP `apply_migration` tool.

---

### Task 1: Migration 072 — scope write RLS + pending-SKUs-per-distribuidor view

**Files:**
- Create: `docs/migrations/072_distribuidor_produto_de_para_escopo_e_pendentes.sql`

**Interfaces:**
- Consumes: `public.current_user_distribuidor_escopo_ok(p_distribuidor_id uuid) RETURNS boolean` (existing, migration 061); `alwayson_distribuidor_produto_de_para(distribuidor_id, codigo_cliente, sku_fornecedor)` (existing, migration 009); `alwayson_faturamento_itens(sku, descricao, valor_total, produto_id, faturamento_id)` (existing); `alwayson_faturamento(id, distribuidor_id, data_emissao)` (existing).
- Produces: a scoped write RLS policy on `alwayson_distribuidor_produto_de_para`, and view `alwayson_faturamento_v_distribuidor_produtos_nao_mapeados(distribuidor_id, sku, descricao, faturamento_total, total_linhas)`. Task 2's hook reads this view by name and column list — do not rename anything.

- [ ] **Step 1: Write the migration file**

```sql
-- Migration 072 — RLS de escrita por escopo em alwayson_distribuidor_produto_de_para
-- + view de pendentes por distribuidor.
--
-- A policy de escrita desta tabela ficou aberta a qualquer authenticated desde
-- a migration 019 ("Fase 1 permissiva"), nunca fechada na Fase 2 (a migration
-- 043 já sinalizava isso como dívida técnica conhecida, sem corrigir). Como
-- este trabalho entrega uma tela nova que facilita escrever ali (seção "SKUs
-- não mapeados" em AdminDeParaProdutos.tsx), fechar o RLS agora é
-- pré-requisito, não escopo extra — do contrário a tela nova amplia o buraco
-- existente.
--
-- Projeto canônico: osukbalwykbqvoumddxz

DROP POLICY IF EXISTS alwayson_distribuidor_produto_de_para_write_authenticated
  ON alwayson_distribuidor_produto_de_para;

CREATE POLICY alwayson_distribuidor_produto_de_para_write_escopo
  ON alwayson_distribuidor_produto_de_para
  FOR ALL
  TO authenticated
  USING (public.current_user_distribuidor_escopo_ok(distribuidor_id))
  WITH CHECK (public.current_user_distribuidor_escopo_ok(distribuidor_id));

-- View de pendentes por distribuidor: mesma forma da view global
-- (alwayson_faturamento_v_produtos_nao_mapeados, migration 069), mas o
-- GROUP BY inclui distribuidor_id e o anti-join é contra
-- alwayson_distribuidor_produto_de_para (código bruto do próprio
-- distribuidor), não contra o de-para global de fornecedor.
CREATE VIEW alwayson_faturamento_v_distribuidor_produtos_nao_mapeados
WITH (security_invoker = true) AS
SELECT
  f.distribuidor_id,
  i.sku,
  (array_agg(i.descricao ORDER BY f.data_emissao DESC))[1] AS descricao,
  sum(i.valor_total) AS faturamento_total,
  count(*) AS total_linhas
FROM alwayson_faturamento_itens i
JOIN alwayson_faturamento f ON f.id = i.faturamento_id
WHERE i.produto_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM alwayson_distribuidor_produto_de_para d
    WHERE d.distribuidor_id = f.distribuidor_id AND d.codigo_cliente = i.sku
  )
GROUP BY f.distribuidor_id, i.sku;

COMMENT ON VIEW alwayson_faturamento_v_distribuidor_produtos_nao_mapeados IS
  'SKUs (códigos brutos do distribuidor) faturados sem produto_id resolvido e sem entrada no de-para por distribuidor — fila de curadoria em /admin/distribuidores/:id/de-para-produtos.';
```

- [ ] **Step 2: Apply the migration to the live database**

Use the Supabase MCP `apply_migration` tool (project ref `osukbalwykbqvoumddxz`), passing the exact SQL from Step 1 with `name: "distribuidor_produto_de_para_escopo_e_pendentes"`.

- [ ] **Step 3: Verify the RLS policy is scoped correctly**

Run via the Supabase MCP `execute_sql` tool:

```sql
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'alwayson_distribuidor_produto_de_para';
```

Expected: exactly 2 policies — `alwayson_distribuidor_produto_de_para_select_escopo` (SELECT, unchanged) and `alwayson_distribuidor_produto_de_para_write_escopo` (ALL, both `qual` and `with_check` calling `current_user_distribuidor_escopo_ok(distribuidor_id)`). No `alwayson_distribuidor_produto_de_para_write_authenticated` should remain.

- [ ] **Step 4: Verify the pending view returns the expected data**

```sql
SELECT distribuidor_id, sku, descricao, faturamento_total, total_linhas
FROM alwayson_faturamento_v_distribuidor_produtos_nao_mapeados
ORDER BY faturamento_total DESC;
```

Expected: 7 rows, all with `distribuidor_id = '6b551b8c-2f3e-4b3b-94f0-c34ac59be9e4'` (Paraty), matching skus `178634`, `178630`, `178612`, `190265`, `220823`, `220824`, `178624` with non-null `descricao`. (These are the same 7 raw codes already visible in `/admin/produtos` today — this view is scoped per-distribuidor and reads a different underlying gap, so seeing the same codes here is expected, not a duplicate bug.)

- [ ] **Step 5: Run the Supabase advisor check**

Use the Supabase MCP `get_advisors` tool with `type: "security"`. Confirm no new lint fires against `alwayson_faturamento_v_distribuidor_produtos_nao_mapeados` or the new policy beyond what's already accepted for identically-shaped objects elsewhere in this project (e.g. `alwayson_faturamento_v_produtos_nao_mapeados` from migration 069 already passes clean).

- [ ] **Step 6: Commit**

```bash
git add docs/migrations/072_distribuidor_produto_de_para_escopo_e_pendentes.sql
git commit -m "feat(db): escopo de escrita no de-para por distribuidor + view de pendentes"
```

---

### Task 2: `useDistribuidorProdutosNaoMapeados` hook + type + invalidation wiring

**Files:**
- Modify: `src/types/distribuidor.ts`
- Modify: `src/hooks/useDistribuidorProdutoDePara.ts`

**Interfaces:**
- Consumes: `alwayson_faturamento_v_distribuidor_produtos_nao_mapeados` (Task 1).
- Produces: type `DistribuidorProdutoNaoMapeado` (in `src/types/distribuidor.ts`); hook `useDistribuidorProdutosNaoMapeados(distribuidorId: string | undefined)` returning `{ data: DistribuidorProdutoNaoMapeado[], isPending, ... }` (same TanStack Query shape as every other hook in this codebase). Task 3's UI imports both by these exact names.

- [ ] **Step 1: Add the new type to `src/types/distribuidor.ts`**

Find the existing `DistribuidorProdutoDePara` interface (currently at lines 139-147):

```typescript
export interface DistribuidorProdutoDePara {
  id: string
  distribuidor_id: string
  codigo_cliente: string
  sku_fornecedor: string
  ativo: boolean
  criado_em: string
  atualizado_em: string
}
```

Add this new interface directly after it:

```typescript

/** Código bruto do distribuidor faturado sem produto_id resolvido e sem entrada no de-para deste distribuidor. */
export interface DistribuidorProdutoNaoMapeado {
  sku: string
  descricao: string
  faturamento_total: number
  total_linhas: number
}
```

- [ ] **Step 2: Add the hook and wire invalidation, in `src/hooks/useDistribuidorProdutoDePara.ts`**

Current file content:

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { DistribuidorProdutoDePara } from '@/types/distribuidor'

export function useDistribuidorProdutoDePara(distribuidorId: string | undefined) {
  return useQuery({
    queryKey: ['distribuidor-produto-de-para', distribuidorId],
    queryFn: async () => {
      if (!distribuidorId) return []
      const { data, error } = await supabase
        .from('alwayson_distribuidor_produto_de_para')
        .select('*')
        .eq('distribuidor_id', distribuidorId)
        .order('codigo_cliente')
      if (error) throw error
      return data as DistribuidorProdutoDePara[]
    },
    enabled: !!distribuidorId,
  })
}

export function useUpsertDistribuidorProdutoDePara() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (args: {
      distribuidor_id: string
      rows: Array<{ codigo_cliente: string; sku_fornecedor: string }>
    }) => {
      const now = new Date().toISOString()
      const payloads = args.rows.map((r) => ({
        distribuidor_id: args.distribuidor_id,
        codigo_cliente: r.codigo_cliente.trim(),
        sku_fornecedor: String(r.sku_fornecedor).trim(),
        ativo: true,
        atualizado_em: now,
      }))
      const { error } = await supabase
        .from('alwayson_distribuidor_produto_de_para')
        .upsert(payloads, { onConflict: 'distribuidor_id,codigo_cliente' })
      if (error) throw error
    },
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({
        queryKey: ['distribuidor-produto-de-para', vars.distribuidor_id],
      })
    },
  })
}
```

Replace the entire file with:

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { DistribuidorProdutoDePara, DistribuidorProdutoNaoMapeado } from '@/types/distribuidor'

function n(x: unknown): number {
  const v = Number(x)
  return Number.isFinite(v) ? v : 0
}

export function useDistribuidorProdutoDePara(distribuidorId: string | undefined) {
  return useQuery({
    queryKey: ['distribuidor-produto-de-para', distribuidorId],
    queryFn: async () => {
      if (!distribuidorId) return []
      const { data, error } = await supabase
        .from('alwayson_distribuidor_produto_de_para')
        .select('*')
        .eq('distribuidor_id', distribuidorId)
        .order('codigo_cliente')
      if (error) throw error
      return data as DistribuidorProdutoDePara[]
    },
    enabled: !!distribuidorId,
  })
}

/** SKUs brutos do distribuidor faturados sem produto_id e sem entrada no de-para dele — fila de curadoria. */
export function useDistribuidorProdutosNaoMapeados(distribuidorId: string | undefined) {
  return useQuery({
    queryKey: ['distribuidor-produtos-nao-mapeados', distribuidorId],
    staleTime: 30_000,
    enabled: !!distribuidorId,
    queryFn: async (): Promise<DistribuidorProdutoNaoMapeado[]> => {
      if (!distribuidorId) return []
      const { data, error } = await supabase
        .from('alwayson_faturamento_v_distribuidor_produtos_nao_mapeados')
        .select('*')
        .eq('distribuidor_id', distribuidorId)
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

export function useUpsertDistribuidorProdutoDePara() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (args: {
      distribuidor_id: string
      rows: Array<{ codigo_cliente: string; sku_fornecedor: string }>
    }) => {
      const now = new Date().toISOString()
      const payloads = args.rows.map((r) => ({
        distribuidor_id: args.distribuidor_id,
        codigo_cliente: r.codigo_cliente.trim(),
        sku_fornecedor: String(r.sku_fornecedor).trim(),
        ativo: true,
        atualizado_em: now,
      }))
      const { error } = await supabase
        .from('alwayson_distribuidor_produto_de_para')
        .upsert(payloads, { onConflict: 'distribuidor_id,codigo_cliente' })
      if (error) throw error
    },
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({
        queryKey: ['distribuidor-produto-de-para', vars.distribuidor_id],
      })
      void qc.invalidateQueries({
        queryKey: ['distribuidor-produtos-nao-mapeados', vars.distribuidor_id],
      })
    },
  })
}
```

(Only change from the original: the new `n()` helper, the new `useDistribuidorProdutosNaoMapeados` export, the `DistribuidorProdutoNaoMapeado` import, and one added `invalidateQueries` call in `useUpsertDistribuidorProdutoDePara`'s `onSuccess` — so the pending list refreshes immediately after either the bulk-upload flow or Task 3's manual single-row link.)

- [ ] **Step 3: Type-check**

Run: `npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 4: Live sanity check against the pending view for Paraty**

Use the Supabase MCP `execute_sql` tool:

```sql
SELECT sku, descricao, faturamento_total, total_linhas
FROM alwayson_faturamento_v_distribuidor_produtos_nao_mapeados
WHERE distribuidor_id = '6b551b8c-2f3e-4b3b-94f0-c34ac59be9e4'
ORDER BY faturamento_total DESC;
```

Expected: 7 rows, matching Task 1's Step 4 verification — confirms the hook's row shape matches what the view actually returns.

- [ ] **Step 5: Commit**

```bash
git add src/types/distribuidor.ts src/hooks/useDistribuidorProdutoDePara.ts
git commit -m "feat: hook e tipo de SKUs não mapeados por distribuidor"
```

---

### Task 3: "SKUs não mapeados" section in `AdminDeParaProdutos.tsx`

**Files:**
- Modify: `src/pages/admin/AdminDeParaProdutos.tsx`

**Interfaces:**
- Consumes: `useDistribuidorProdutosNaoMapeados` (Task 2); `useUpsertDistribuidorProdutoDePara` (existing, already imported in this file — reused unmodified with `mutateAsync({ distribuidor_id, rows: [{ codigo_cliente, sku_fornecedor }] })`); `useProdutos` (existing, already imported in this file).
- Produces: nothing new is exported — this task only adds a UI section to the existing page component.

- [ ] **Step 1: Add the new imports**

Change the top of the file from:

```typescript
import { useCallback, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArrowRight, Download, Loader2, Upload } from 'lucide-react'
import { PageHeader } from '@/components/distribuidor/PageHeader'
import { SectionTitle } from '@/components/distribuidor/SectionTitle'
import { FilterBar, FilterField } from '@/components/distribuidor/FilterBar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useDistribuidores } from '@/hooks/useDistribuidores'
import {
  useDistribuidorProdutoDePara,
  useUpsertDistribuidorProdutoDePara,
} from '@/hooks/useDistribuidorProdutoDePara'
import { useProdutos } from '@/hooks/useProdutos'
import {
  parseDeParaCsv,
  parseDeParaXlsx,
} from '@/lib/parseDeParaProdutoUpload'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
```

to:

```typescript
import { useCallback, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArrowRight, Download, Link2, Loader2, Unlink, Upload } from 'lucide-react'
import { PageHeader } from '@/components/distribuidor/PageHeader'
import { SectionTitle } from '@/components/distribuidor/SectionTitle'
import { FilterBar, FilterField } from '@/components/distribuidor/FilterBar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useDistribuidores } from '@/hooks/useDistribuidores'
import {
  useDistribuidorProdutoDePara,
  useDistribuidorProdutosNaoMapeados,
  useUpsertDistribuidorProdutoDePara,
} from '@/hooks/useDistribuidorProdutoDePara'
import { useProdutos } from '@/hooks/useProdutos'
import {
  parseDeParaCsv,
  parseDeParaXlsx,
} from '@/lib/parseDeParaProdutoUpload'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/format'
import { Skeleton } from '@/components/ui/skeleton'
```

- [ ] **Step 2: Add state for the manual-link flow and the pending-SKUs query**

Change:

```typescript
  const [fileName, setFileName] = useState<string | null>(null)
  const [preview, setPreview] = useState<
    Array<{ codigo_cliente: string; sku_fornecedor: string }>
  >([])
  const [parseError, setParseError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const { data: distribuidores, isLoading: loadingDist } = useDistribuidores()
  const { data: existentes, isLoading: loadingMap } = useDistribuidorProdutoDePara(
    did || undefined
  )
  const { data: produtos } = useProdutos()
  const upsert = useUpsertDistribuidorProdutoDePara()

  const skuValidos = useMemo(() => {
    const s = new Set<string>()
    for (const p of produtos ?? []) {
      s.add(p.sku.trim())
    }
    return s
  }, [produtos])
```

to:

```typescript
  const [fileName, setFileName] = useState<string | null>(null)
  const [preview, setPreview] = useState<
    Array<{ codigo_cliente: string; sku_fornecedor: string }>
  >([])
  const [parseError, setParseError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [linkDraft, setLinkDraft] = useState<Record<string, string>>({})
  const [linkingSku, setLinkingSku] = useState<string | null>(null)
  const [linkError, setLinkError] = useState<string | null>(null)
  const [linkNotice, setLinkNotice] = useState<string | null>(null)

  const { data: distribuidores, isLoading: loadingDist } = useDistribuidores()
  const { data: existentes, isLoading: loadingMap } = useDistribuidorProdutoDePara(
    did || undefined
  )
  const { data: naoMapeados = [], isPending: loadingNaoMap } = useDistribuidorProdutosNaoMapeados(
    did || undefined
  )
  const { data: produtos } = useProdutos()
  const upsert = useUpsertDistribuidorProdutoDePara()

  const skuValidos = useMemo(() => {
    const s = new Set<string>()
    for (const p of produtos ?? []) {
      s.add(p.sku.trim())
    }
    return s
  }, [produtos])

  const produtoBySku = useMemo(() => {
    const m = new Map<string, string>()
    for (const p of produtos ?? []) {
      m.set(p.sku.trim(), p.descricao)
    }
    return m
  }, [produtos])
```

- [ ] **Step 3: Add the `handleVincular` handler**

Find `handleGravar` (currently):

```typescript
  const handleGravar = async () => {
    setSaveError(null)
    if (!did || preview.length === 0) return
    try {
      await upsert.mutateAsync({
        distribuidor_id: did,
        rows: preview,
      })
      setPreview([])
      setFileName(null)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Erro ao gravar')
    }
  }
```

Add this new function directly after it:

```typescript

  const handleVincular = async (sku: string) => {
    setLinkError(null)
    setLinkNotice(null)
    if (!did) return
    const codigo = (linkDraft[sku] ?? '').trim()
    if (!codigo) {
      setLinkError('Informe o SKU do catálogo.')
      return
    }
    if (!skuValidos.has(codigo)) {
      setLinkError(`SKU ${codigo} não existe em Produtos.`)
      return
    }
    setLinkingSku(sku)
    try {
      await upsert.mutateAsync({
        distribuidor_id: did,
        rows: [{ codigo_cliente: sku, sku_fornecedor: codigo }],
      })
      setLinkDraft((prev) => {
        const next = { ...prev }
        delete next[sku]
        return next
      })
      setLinkNotice(`Vinculado ${sku} → ${codigo}.`)
    } catch (e) {
      setLinkError(e instanceof Error ? e.message : 'Falha ao vincular')
    } finally {
      setLinkingSku(null)
    }
  }
```

- [ ] **Step 4: Insert the "SKUs não mapeados" card into the JSX**

Find the boundary between the (optional) `FilterBar` block and the "Upload do mapeamento" `Card` — currently:

```tsx
      {!scopedToRoute && (
        <FilterBar>
          <FilterField label="Distribuidor">
            <Select
              value={did || undefined}
              onValueChange={(v) => onDistribChange(v ?? '')}
              disabled={loadingDist}
            >
              <SelectTrigger className="h-8 text-sm w-[min(100%,280px)]">
                <SelectValue placeholder="Selecione o distribuidor" />
              </SelectTrigger>
              <SelectContent>
                {(distribuidores ?? []).map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>
        </FilterBar>
      )}

      <Card>
        <CardContent className="p-4 space-y-4">
          <SectionTitle title="Upload do mapeamento" icon={Upload} />
```

Insert this new `Card` between the closing `)}` of the `FilterBar` block and the `<Card>` that starts "Upload do mapeamento":

```tsx
      {!scopedToRoute && (
        <FilterBar>
          <FilterField label="Distribuidor">
            <Select
              value={did || undefined}
              onValueChange={(v) => onDistribChange(v ?? '')}
              disabled={loadingDist}
            >
              <SelectTrigger className="h-8 text-sm w-[min(100%,280px)]">
                <SelectValue placeholder="Selecione o distribuidor" />
              </SelectTrigger>
              <SelectContent>
                {(distribuidores ?? []).map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>
        </FilterBar>
      )}

      {did && (
        <Card>
          <CardContent className="space-y-4 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <SectionTitle title="SKUs não mapeados" icon={Unlink} />
                <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
                  Faturados sem produto correspondente e sem correlação cadastrada para este
                  distribuidor — vincule ao SKU oficial para corrigir na próxima reimportação.
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
                Nenhum SKU pendente — todo o faturamento deste distribuidor resolve para o
                catálogo.
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
                      const draft = linkDraft[r.sku] ?? ''
                      const draftNorm = draft.trim()
                      const ok = draftNorm ? skuValidos.has(draftNorm) : false
                      const busy = linkingSku === r.sku || upsert.isPending
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
                                    setLinkDraft((prev) => ({ ...prev, [r.sku]: e.target.value }))
                                  }
                                  placeholder="ex. 11.5004"
                                  className="h-8 font-mono text-xs"
                                  list="distribuidor-sku-catalogo-list"
                                />
                                {draftNorm && (
                                  <p
                                    className={cn(
                                      'mt-0.5 truncate text-[10px]',
                                      ok
                                        ? 'text-emerald-700 dark:text-emerald-400'
                                        : 'text-amber-700'
                                    )}
                                  >
                                    {ok
                                      ? produtoBySku.get(draftNorm) || 'No catálogo'
                                      : 'SKU ausente no catálogo'}
                                  </p>
                                )}
                              </div>
                              <button
                                type="button"
                                disabled={!ok || busy}
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

            <datalist id="distribuidor-sku-catalogo-list">
              {(produtos ?? []).slice(0, 800).map((p) => (
                <option key={p.sku} value={p.sku}>
                  {p.descricao}
                </option>
              ))}
            </datalist>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 space-y-4">
          <SectionTitle title="Upload do mapeamento" icon={Upload} />
```

- [ ] **Step 5: Type-check and build**

Run: `npx tsc -b --noEmit`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 6: Manual verification in the browser**

Start the dev server (`npm run dev`), sign in, open `/admin/distribuidores/6b551b8c-2f3e-4b3b-94f0-c34ac59be9e4/de-para-produtos` (Paraty's own de-para page), and confirm:
- A "SKUs não mapeados" card appears above "Upload do mapeamento", listing 7 rows sorted by faturamento descending (`178634`, `178630`, `178612`, `190265`, `220823`, `220824`, `178624`).
- Typing a valid catalog SKU (e.g. `11.3002`) shows its description in emerald and enables "Vincular"; typing an invalid one shows amber and keeps the button disabled.
- Typing a partial SKU or product name into the input shows the browser's native autocomplete dropdown (from the new `<datalist>`), listing catalog SKUs with their descriptions.
- Clicking "Vincular" on a valid pair writes to `alwayson_distribuidor_produto_de_para` and the row disappears from "SKUs não mapeados" (the invalidation from Task 2's Step 2 refetches both queries).
- If browser login isn't available in this environment (same limitation as the prior plan's Tasks 4/6), substitute: confirm via Supabase MCP `execute_sql` that a manual insert respects the new RLS (as a role without `current_user_distribuidor_escopo_ok(distribuidor_id)` = true, the insert should fail; as admin, it should succeed) — reproduce Task 1's RLS scoping live rather than just reading the policy definition.

- [ ] **Step 7: Commit**

```bash
git add src/pages/admin/AdminDeParaProdutos.tsx
git commit -m "feat(admin): SKUs não mapeados por distribuidor em Correlação de Produtos"
```

---

### Task 4: `<datalist>` autocomplete on the existing global curation screen

**Files:**
- Modify: `src/pages/admin/AdminProdutosCuradoria.tsx`

**Interfaces:**
- Consumes: `produtos` (existing `useProdutos()` result, already fetched in this file at line 31).
- Produces: nothing new is exported — this task only adds an autocomplete affordance to the existing "SKU do catálogo" input.

- [ ] **Step 1: Add the `list` attribute to the existing `<Input>`**

Find (currently at lines 147-154):

```tsx
                              <Input
                                value={draft}
                                onChange={(e) =>
                                  setSkuDraft((prev) => ({ ...prev, [r.sku]: e.target.value }))
                                }
                                placeholder="ex. 11.5004"
                                className="h-8 font-mono text-xs"
                              />
```

Change to:

```tsx
                              <Input
                                value={draft}
                                onChange={(e) =>
                                  setSkuDraft((prev) => ({ ...prev, [r.sku]: e.target.value }))
                                }
                                placeholder="ex. 11.5004"
                                className="h-8 font-mono text-xs"
                                list="curadoria-sku-catalogo-list"
                              />
```

- [ ] **Step 2: Add the `<datalist>` element**

Find the closing of the first `<Card>`'s conditional block (currently at lines 200-204):

```tsx
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <SectionTitle title="Mapeamentos cadastrados" icon={Link2} />
```

Change to:

```tsx
            </div>
          )}

          <datalist id="curadoria-sku-catalogo-list">
            {(produtos ?? []).slice(0, 800).map((p) => (
              <option key={p.sku} value={p.sku}>
                {p.descricao}
              </option>
            ))}
          </datalist>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <SectionTitle title="Mapeamentos cadastrados" icon={Link2} />
```

- [ ] **Step 3: Type-check and build**

Run: `npx tsc -b --noEmit`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Manual verification in the browser**

Open `/admin/produtos` (already covered by the prior plan's known auth limitation — substitute code review if browser login isn't available: confirm the `list`/`<datalist>` wiring matches `AdminInsightsDeParaProdutos.tsx`'s already-shipped, already-working pattern exactly). If a session is available: type a partial SKU or product name into the "SKU do catálogo" input on any pending row and confirm the native autocomplete dropdown appears with catalog matches.

- [ ] **Step 5: Commit**

```bash
git add src/pages/admin/AdminProdutosCuradoria.tsx
git commit -m "feat(admin): autocomplete de SKU na curadoria global de produtos"
```
