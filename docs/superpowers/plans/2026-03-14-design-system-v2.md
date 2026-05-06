# Design System v2 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the Arruda Hub Design System v2 (Navy+Teal, OKLCH tokens, semantic status colors, proper typography/spacing/shadows) to the Distribuidor+ project, transforming it from a flat gray UI to a world-class B2B dashboard.

**Architecture:** Bottom-up approach — tokens first, then base components, then domain components, then pages. Each task is independently verifiable. No new dependencies needed (all packages already installed).

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4 (OKLCH, `@theme inline`), shadcn/ui (Base UI), Vite 7

**Design System Reference:** `.interface-design/system.md`

---

## File Map

### Layer 1: Tokens
- **Modify:** `src/index.css` — Replace all CSS tokens (colors, shadows, animations)

### Layer 2: Utilities
- **Create:** `src/lib/format.ts` — Shared formatCurrency + formatDate
- **Modify:** `src/lib/utils.ts` — No changes needed (cn() already correct)

### Layer 3: Base Components (shadcn/ui)
- **Modify:** `src/components/ui/badge.tsx` — Add success/warning/info/accent variants
- **Modify:** `src/components/ui/card.tsx` — Apply shadow-card, rounded-lg defaults
- **Modify:** `src/components/ui/table.tsx` — Apply DS table header/cell specs
- **Modify:** `src/components/ui/progress.tsx` — Fix bar height to h-2

### Layer 4: Domain Components
- **Modify:** `src/components/distribuidor/KPICard.tsx` — DS typography (text-lg value, w-4 h-4 icons, text-[11px] labels)
- **Modify:** `src/components/distribuidor/KPIGrid.tsx` — gap-4, responsive fix
- **Modify:** `src/components/distribuidor/StatusBadge.tsx` — Use Badge variants instead of hardcoded colors
- **Modify:** `src/components/distribuidor/MetaProgressBar.tsx` — Use semantic tokens, fix overlapping bars, h-2
- **Modify:** `src/components/distribuidor/PageHeader.tsx` — DS typography (text-lg title, mb-6)
- **Modify:** `src/components/distribuidor/SectionTitle.tsx` — w-4 h-4 icon, gap-2, mb-3
- **Modify:** `src/components/distribuidor/IngestaoUpload.tsx` — Semantic status colors, DS spacing
- **Create:** `src/components/distribuidor/FilterBar.tsx` — Reusable filter card pattern
- **Create:** `src/components/distribuidor/EmptyState.tsx` — Reusable empty state pattern

### Layer 5: Layout
- **Modify:** `src/components/layout/AppLayout.tsx` — p-6 padding
- **Modify:** `src/components/layout/Sidebar.tsx` — w-56, DS typography, Navy branding

### Layer 6: Pages
- **Modify:** `src/pages/Dashboard.tsx` — DS spacing, remove inline card styles, use EmptyState
- **Modify:** `src/pages/DistribuidoresList.tsx` — Use FilterBar, DS table specs
- **Modify:** `src/pages/DistribuidorDetail.tsx` — DS spacing/typography, remove formatCurrency
- **Modify:** `src/pages/PerformanceList.tsx` — Use FilterBar, DS table specs
- **Modify:** `src/pages/ExcelenciaList.tsx` — DS table specs
- **Modify:** `src/pages/MetasPanel.tsx` — Use FilterBar, DS spacing
- **Modify:** `src/pages/EstoquePanel.tsx` — Use FilterBar, DS table specs
- **Modify:** `src/pages/IngestaoPanel.tsx` — DS spacing

---

## Chunk 1: Foundation (Tokens + Utilities + Base Components)

### Task 1: Update CSS Tokens

**Files:**
- Modify: `src/index.css`

This is the foundation — all other changes depend on these tokens.

- [ ] **Step 1: Replace `:root` light mode tokens**

Replace the entire `:root` block with Navy/Teal/Gray OKLCH tokens:

```css
:root {
  /* Brand */
  --navy: oklch(0.25 0.05 250);
  --navy-hover: oklch(0.30 0.05 250);
  --navy-light: oklch(0.35 0.05 250);
  --teal: oklch(0.70 0.15 175);
  --teal-hover: oklch(0.65 0.15 175);

  /* Gray scale (blue-tinted) */
  --gray-50: oklch(0.98 0.005 250);
  --gray-100: oklch(0.96 0.005 250);
  --gray-200: oklch(0.91 0.005 250);
  --gray-400: oklch(0.70 0.01 250);
  --gray-600: oklch(0.50 0.02 250);
  --gray-900: oklch(0.20 0.02 250);

  /* Status */
  --status-success: oklch(0.60 0.19 145);
  --status-warning: oklch(0.65 0.18 70);
  --status-danger: oklch(0.55 0.22 25);
  --status-info: oklch(0.55 0.20 260);

  /* Semantic tokens */
  --background: var(--gray-50);
  --foreground: var(--gray-900);
  --card: oklch(1 0 0);
  --card-foreground: var(--gray-900);
  --popover: oklch(1 0 0);
  --popover-foreground: var(--gray-900);
  --primary: var(--navy);
  --primary-foreground: oklch(0.98 0 0);
  --secondary: oklch(1 0 0);
  --secondary-foreground: var(--navy);
  --muted: var(--gray-100);
  --muted-foreground: var(--gray-600);
  --accent: var(--teal);
  --accent-foreground: oklch(0.98 0 0);
  --destructive: var(--status-danger);
  --destructive-foreground: var(--status-danger);
  --success: var(--status-success);
  --warning: var(--status-warning);
  --info: var(--status-info);
  --border: var(--gray-200);
  --input: var(--gray-200);
  --ring: var(--navy);
  --radius: 0.5rem;

  /* Sidebar */
  --sidebar-background: oklch(1 0 0);
  --sidebar-foreground: var(--navy);
  --sidebar-primary: var(--navy);
  --sidebar-primary-foreground: oklch(0.98 0 0);
  --sidebar-accent: var(--gray-50);
  --sidebar-accent-foreground: var(--navy);
  --sidebar-border: var(--gray-200);
  --sidebar-ring: var(--navy);
  --sidebar: oklch(1 0 0);

  /* Charts */
  --chart-1: oklch(0.55 0.20 260);
  --chart-2: oklch(0.70 0.15 175);
  --chart-3: oklch(0.65 0.18 310);
  --chart-4: oklch(0.65 0.18 70);
  --chart-5: oklch(0.60 0.19 145);
}
```

- [ ] **Step 2: Replace `.dark` tokens**

```css
.dark {
  --background: var(--gray-900);
  --foreground: var(--gray-50);
  --card: oklch(0.22 0.02 250);
  --card-foreground: var(--gray-50);
  --popover: oklch(0.22 0.02 250);
  --popover-foreground: var(--gray-50);
  --primary: oklch(0.92 0.005 250);
  --primary-foreground: var(--navy);
  --secondary: oklch(0.27 0.02 250);
  --secondary-foreground: var(--gray-50);
  --muted: oklch(0.25 0.02 250);
  --muted-foreground: var(--gray-400);
  --accent: var(--teal);
  --accent-foreground: oklch(0.98 0 0);
  --destructive: oklch(0.65 0.20 25);
  --destructive-foreground: oklch(0.65 0.20 25);
  --success: oklch(0.65 0.17 145);
  --warning: oklch(0.70 0.16 70);
  --info: oklch(0.60 0.18 260);
  --border: oklch(1 0 0 / 12%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.55 0.005 250);
  --sidebar-background: oklch(0.18 0.03 250);
  --sidebar-foreground: oklch(0.96 0.005 250);
  --sidebar-primary: oklch(0.96 0.005 250);
  --sidebar-primary-foreground: var(--navy);
  --sidebar-accent: oklch(0.25 0.03 250);
  --sidebar-accent-foreground: oklch(0.96 0.005 250);
  --sidebar-border: oklch(1 0 0 / 10%);
  --sidebar-ring: oklch(0.55 0.005 250);
  --sidebar: oklch(0.18 0.03 250);
  --chart-1: oklch(0.60 0.18 260);
  --chart-2: oklch(0.70 0.15 175);
  --chart-3: oklch(0.68 0.16 310);
  --chart-4: oklch(0.68 0.16 70);
  --chart-5: oklch(0.65 0.17 145);
}
```

- [ ] **Step 3: Update `@theme inline` block**

Add new semantic color mappings and shadow tokens:

```css
@theme inline {
  /* Keep existing mappings, add: */
  --color-navy: var(--navy);
  --color-navy-hover: var(--navy-hover);
  --color-teal: var(--teal);
  --color-teal-hover: var(--teal-hover);
  --color-success: var(--success);
  --color-warning: var(--warning);
  --color-info: var(--info);

  /* Shadows */
  --shadow-card: 0 1px 3px oklch(0 0 0 / 8%), 0 1px 2px oklch(0 0 0 / 6%);
  --shadow-card-hover: 0 4px 6px oklch(0 0 0 / 8%), 0 2px 4px oklch(0 0 0 / 6%);
  --shadow-elevated: 0 10px 15px oklch(0 0 0 / 10%), 0 4px 6px oklch(0 0 0 / 5%);
}
```

- [ ] **Step 4: Add `animate-fade-in` keyframes**

Add after the `@layer base` block:

```css
@keyframes fade-in {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}
```

And in `@theme inline`, add:
```css
--animate-fade-in: fade-in 200ms ease-out;
```

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: No errors. Tokens are CSS-only, no component changes yet.

- [ ] **Step 6: Commit**

```bash
git add src/index.css
git commit -m "feat: replace CSS tokens with Arruda Hub DS v2 (Navy/Teal, OKLCH, semantic status)"
```

---

### Task 2: Create Shared Format Utilities

**Files:**
- Create: `src/lib/format.ts`

- [ ] **Step 1: Create format.ts**

```ts
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('pt-BR')
}

export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/format.ts
git commit -m "feat: add shared format utilities (currency, date)"
```

---

### Task 3: Update Badge Component — Add Semantic Variants

**Files:**
- Modify: `src/components/ui/badge.tsx`

- [ ] **Step 1: Add success, warning, info, and accent variants**

In the `badgeVariants` cva `variants.variant` object, add 4 new variants alongside the existing ones. Also change `rounded-4xl` to `rounded-sm` and update base styles per DS:

Replace the entire `badgeVariants` definition:

```ts
const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-sm border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground border-transparent [a]:hover:bg-primary/80",
        secondary:
          "bg-secondary text-secondary-foreground border-border [a]:hover:bg-secondary/80",
        destructive:
          "bg-destructive/10 text-destructive border-destructive/20 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20",
        outline:
          "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
        ghost:
          "border-transparent hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "border-transparent text-primary underline-offset-4 hover:underline",
        success:
          "bg-success/10 text-success border-success/20 [a]:hover:bg-success/20",
        warning:
          "bg-warning/10 text-warning border-warning/20 [a]:hover:bg-warning/20",
        info:
          "bg-info/10 text-info border-info/20 [a]:hover:bg-info/20",
        accent:
          "bg-teal/10 text-teal border-teal/20 [a]:hover:bg-teal/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/badge.tsx
git commit -m "feat: add semantic Badge variants (success, warning, info, accent)"
```

---

### Task 4: Update Card Component — Shadow + Rounded-lg

**Files:**
- Modify: `src/components/ui/card.tsx`

- [ ] **Step 1: Update Card base styles**

Replace the Card component's className from `rounded-xl ... ring-1 ring-foreground/10` to use `shadow-card`, `rounded-lg`, `border border-border`:

In the `Card` function, replace the className string:

Old:
```
"group/card flex flex-col gap-4 overflow-hidden rounded-xl bg-card py-4 text-sm text-card-foreground ring-1 ring-foreground/10 has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:gap-3 data-[size=sm]:py-3 data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl"
```

New:
```
"group/card flex flex-col gap-4 overflow-hidden rounded-lg border border-border bg-card py-4 text-sm text-card-foreground shadow-card has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:gap-3 data-[size=sm]:py-3 data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-lg *:[img:last-child]:rounded-b-lg"
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/card.tsx
git commit -m "feat: update Card with shadow-card, rounded-lg, border-border"
```

---

### Task 5: Update Table Component — DS Header/Cell Specs

**Files:**
- Modify: `src/components/ui/table.tsx`

- [ ] **Step 1: Update TableHead default styles**

Replace TableHead className:

Old:
```
"h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0"
```

New:
```
"h-9 px-3 text-left align-middle text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap text-muted-foreground [&:has([role=checkbox])]:pr-0"
```

- [ ] **Step 2: Update TableCell default styles**

Replace TableCell className:

Old:
```
"p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0"
```

New:
```
"py-2.5 px-3 align-middle whitespace-nowrap text-sm [&:has([role=checkbox])]:pr-0"
```

- [ ] **Step 3: Update TableRow hover**

Replace TableRow className:

Old:
```
"border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
```

New:
```
"border-b border-border/50 transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/table.tsx
git commit -m "feat: update Table with DS header (11px uppercase) and cell (py-2.5) specs"
```

---

### Task 6: Update Progress Component — h-2 Track

**Files:**
- Modify: `src/components/ui/progress.tsx`

- [ ] **Step 1: Update ProgressTrack height**

In `ProgressTrack`, change `h-1` to `h-2`:

Old:
```
"relative flex h-1 w-full items-center overflow-x-hidden rounded-full bg-muted"
```

New:
```
"relative flex h-2 w-full items-center overflow-x-hidden rounded-full bg-muted"
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/progress.tsx
git commit -m "feat: update Progress track height to h-2 per DS"
```

---

## Chunk 2: Domain Components

### Task 7: Rewrite StatusBadge — Use Badge Variants

**Files:**
- Modify: `src/components/distribuidor/StatusBadge.tsx`

This is a critical change — replaces ~50 lines of hardcoded colors with Badge variants.

- [ ] **Step 1: Rewrite StatusBadge to use Badge component**

Replace the entire file:

```tsx
import { Badge } from '@/components/ui/badge'

type StatusType =
  | 'ativo'
  | 'inativo'
  | 'em_analise'
  | 'em_risco'
  | 'critico'
  | 'ruptura'
  | 'baixo'
  | 'normal'
  | 'excelencia'
  | 'pendente'
  | 'processando'
  | 'concluido'
  | 'erro'

type BadgeVariant = 'success' | 'warning' | 'destructive' | 'info' | 'secondary' | 'accent'

const statusConfig: Record<StatusType, { label: string; variant: BadgeVariant }> = {
  ativo:        { label: 'Ativo',        variant: 'success' },
  normal:       { label: 'Normal',       variant: 'success' },
  concluido:    { label: 'Concluido',    variant: 'success' },
  em_analise:   { label: 'Em Analise',   variant: 'info' },
  processando:  { label: 'Processando',  variant: 'info' },
  em_risco:     { label: 'Em Risco',     variant: 'warning' },
  baixo:        { label: 'Baixo',        variant: 'warning' },
  pendente:     { label: 'Pendente',     variant: 'warning' },
  critico:      { label: 'Critico',      variant: 'destructive' },
  ruptura:      { label: 'Ruptura',      variant: 'destructive' },
  erro:         { label: 'Erro',         variant: 'destructive' },
  inativo:      { label: 'Inativo',      variant: 'secondary' },
  excelencia:   { label: 'Excelencia',   variant: 'accent' },
}

interface StatusBadgeProps {
  status: StatusType
  label?: string
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const config = statusConfig[status]
  return (
    <Badge variant={config.variant}>
      {label ?? config.label}
    </Badge>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/distribuidor/StatusBadge.tsx
git commit -m "refactor: StatusBadge uses Badge semantic variants instead of hardcoded colors"
```

---

### Task 8: Update KPICard — DS Typography & Icons

**Files:**
- Modify: `src/components/distribuidor/KPICard.tsx`

- [ ] **Step 1: Update typography and icon sizes**

Replace the component body (keep imports and interface unchanged):

```tsx
export function KPICard({
  label,
  value,
  icon: Icon,
  badge,
  subtitle,
  variant = 'default',
  trend,
}: KPICardProps) {
  return (
    <Card
      className={cn(
        variant === 'primary'
          ? 'border-primary/20 bg-primary/5'
          : ''
      )}
      size="sm"
    >
      <CardContent>
        <div className="flex items-center justify-between gap-2 text-muted-foreground text-[11px] font-semibold uppercase tracking-wider mb-2">
          <span className="flex items-center gap-2 truncate">
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{label}</span>
          </span>
          {badge !== undefined && (
            <Badge
              variant="secondary"
              className="shrink-0"
            >
              {badge}
            </Badge>
          )}
        </div>
        <div className="flex items-baseline gap-2">
          <div className="text-lg font-bold tabular-nums text-foreground">
            {value}
          </div>
          {trend && (
            <span
              className={cn(
                'text-xs font-semibold tabular-nums',
                trend.positive ? 'text-success' : 'text-destructive'
              )}
            >
              {trend.positive ? '+' : ''}
              {trend.value.toFixed(1)}%
            </span>
          )}
        </div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1.5">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/distribuidor/KPICard.tsx
git commit -m "feat: update KPICard with DS typography (text-lg value, w-4 icons, text-[11px] labels)"
```

---

### Task 9: Update KPIGrid — gap-4, Better Responsive

**Files:**
- Modify: `src/components/distribuidor/KPIGrid.tsx`

- [ ] **Step 1: Update grid classes**

Replace the component:

```tsx
import type { ReactNode } from 'react'

interface KPIGridProps {
  children: ReactNode
  columns?: 2 | 3 | 4
}

export function KPIGrid({ children, columns = 4 }: KPIGridProps) {
  const gridCols = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-2 md:grid-cols-4',
  }

  return <div className={`grid ${gridCols[columns]} gap-4`}>{children}</div>
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/distribuidor/KPIGrid.tsx
git commit -m "feat: KPIGrid gap-4, grid-cols-2 base for mobile"
```

---

### Task 10: Rewrite MetaProgressBar — Semantic Colors, Fix Overlap

**Files:**
- Modify: `src/components/distribuidor/MetaProgressBar.tsx`

The current implementation overlaps a custom `div` on top of the native Progress. Rewrite to use only the native Progress with dynamic indicator color.

- [ ] **Step 1: Rewrite MetaProgressBar**

```tsx
import { cn } from '@/lib/utils'

interface MetaProgressBarProps {
  label: string
  percentual: number
  meta: string | number
  realizado: string | number
}

function getColorClass(percentual: number) {
  if (percentual >= 100) return 'bg-success'
  if (percentual >= 70) return 'bg-warning'
  return 'bg-destructive'
}

function getTextColor(percentual: number) {
  if (percentual >= 100) return 'text-success'
  if (percentual >= 70) return 'text-warning'
  return 'text-destructive'
}

export function MetaProgressBar({
  label,
  percentual,
  meta,
  realizado,
}: MetaProgressBarProps) {
  const capped = Math.min(percentual, 100)

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-foreground font-medium">{label}</span>
        <span
          className={cn(
            'text-sm font-bold tabular-nums',
            getTextColor(percentual)
          )}
        >
          {percentual.toFixed(1)}%
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            getColorClass(percentual)
          )}
          style={{ width: `${capped}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Realizado: {realizado}</span>
        <span>Meta: {meta}</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/distribuidor/MetaProgressBar.tsx
git commit -m "refactor: MetaProgressBar with semantic colors, fix overlapping bars"
```

---

### Task 11: Update PageHeader — DS Typography

**Files:**
- Modify: `src/components/distribuidor/PageHeader.tsx`

- [ ] **Step 1: Update typography and spacing**

```tsx
import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  description?: string
  actions?: ReactNode
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-lg font-semibold text-foreground">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/distribuidor/PageHeader.tsx
git commit -m "feat: PageHeader text-lg title, mb-6 spacing per DS"
```

---

### Task 12: Update SectionTitle — DS Icons & Spacing

**Files:**
- Modify: `src/components/distribuidor/SectionTitle.tsx`

- [ ] **Step 1: Update icon size and spacing**

```tsx
import type { LucideIcon } from 'lucide-react'

interface SectionTitleProps {
  title: string
  icon: LucideIcon
}

export function SectionTitle({ title, icon: Icon }: SectionTitleProps) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="w-4 h-4 text-muted-foreground" />
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </span>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/distribuidor/SectionTitle.tsx
git commit -m "feat: SectionTitle w-4 h-4 icons, gap-2 per DS"
```

---

### Task 13: Create FilterBar Component

**Files:**
- Create: `src/components/distribuidor/FilterBar.tsx`

Extracts the repeated filter card pattern used in 4+ pages.

- [ ] **Step 1: Create FilterBar**

```tsx
import type { ReactNode } from 'react'
import { Card, CardContent } from '@/components/ui/card'

interface FilterBarProps {
  children: ReactNode
  columns?: 2 | 3 | 4
}

export function FilterBar({ children, columns = 3 }: FilterBarProps) {
  const gridCols = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  }

  return (
    <Card className="mb-6">
      <CardContent>
        <div className={`grid ${gridCols[columns]} gap-4`}>
          {children}
        </div>
      </CardContent>
    </Card>
  )
}

interface FilterFieldProps {
  label: string
  children: ReactNode
}

export function FilterField({ label, children }: FilterFieldProps) {
  return (
    <div>
      <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
        {label}
      </label>
      {children}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/distribuidor/FilterBar.tsx
git commit -m "feat: create FilterBar + FilterField reusable components"
```

---

### Task 14: Create EmptyState Component

**Files:**
- Create: `src/components/distribuidor/EmptyState.tsx`

- [ ] **Step 1: Create EmptyState**

```tsx
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center py-12">
      <Icon className="w-12 h-12 text-muted-foreground/30" />
      <p className="text-sm font-medium text-foreground mt-4">{title}</p>
      {description && (
        <p className="text-xs text-muted-foreground mt-1 max-w-sm text-center">
          {description}
        </p>
      )}
      {action && (
        <Button variant="outline" size="sm" className="mt-4" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/distribuidor/EmptyState.tsx
git commit -m "feat: create EmptyState component per DS pattern"
```

---

### Task 15: Update IngestaoUpload — Semantic Colors

**Files:**
- Modify: `src/components/distribuidor/IngestaoUpload.tsx`

- [ ] **Step 1: Replace hardcoded colors in upload status feedback**

In the upload status display section (~line 212-226), replace:

Old:
```tsx
uploadStatus === 'success' && 'bg-emerald-50 text-emerald-700',
uploadStatus === 'error' && 'bg-red-50 text-red-700'
```

New:
```tsx
uploadStatus === 'success' && 'bg-success/10 text-success',
uploadStatus === 'error' && 'bg-destructive/10 text-destructive'
```

- [ ] **Step 2: Update label classes from `text-[10px]` to `text-[11px]`**

Replace all occurrences of `text-[10px]` in this file with `text-[11px]`.

- [ ] **Step 3: Replace inline card styles**

Remove `rounded-md border border-border/50 shadow-none hover:border-border/80 transition-colors` from the Card — the Card component now handles this via its defaults.

Replace:
```tsx
<Card
  className={cn(
    'rounded-md border border-border/50 shadow-none hover:border-border/80 transition-colors',
    className
  )}
>
```

With:
```tsx
<Card
  className={cn(
    'hover:shadow-card-hover transition-shadow',
    className
  )}
>
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/distribuidor/IngestaoUpload.tsx
git commit -m "feat: IngestaoUpload semantic colors, DS spacing, remove inline card styles"
```

---

## Chunk 3: Layout

### Task 16: Update AppLayout — p-6 Padding

**Files:**
- Modify: `src/components/layout/AppLayout.tsx`

- [ ] **Step 1: Update content padding**

Replace:
```tsx
<div className="p-4 max-w-[1400px] mx-auto">
```

With:
```tsx
<div className="p-6 max-w-[1400px] mx-auto">
```

- [ ] **Step 2: Commit**

```bash
git add src/components/layout/AppLayout.tsx
git commit -m "feat: AppLayout p-6 content padding per DS"
```

---

### Task 17: Update Sidebar — DS Typography & Width

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Update sidebar width**

Change collapsed/expanded widths:

Old: `collapsed ? 'w-14' : 'w-52'`
New: `collapsed ? 'w-14' : 'w-56'`

- [ ] **Step 2: Update icon sizes from w-3.5 h-3.5 to w-4 h-4**

Replace all `w-3.5 h-3.5` in Sidebar with `w-4 h-4`.

- [ ] **Step 3: Update text-[10px] to text-[11px]**

Replace all `text-[10px]` in Sidebar with `text-[11px]`.

- [ ] **Step 4: Update nav link height and text**

Change link height from `h-8` to `h-9`:

Old: `'flex items-center gap-2.5 h-8 px-2 rounded-md text-xs transition-colors'`
New: `'flex items-center gap-2.5 h-9 px-2.5 rounded-md text-sm transition-colors'`

- [ ] **Step 5: Update logo area**

Change logo icon from `w-6 h-6` to `w-7 h-7`, text from `text-xs` to `text-sm`:

Old:
```tsx
<div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
  <span className="text-[10px] font-bold text-primary-foreground">D+</span>
</div>
<span className="text-xs font-semibold text-foreground">Distribuidor+</span>
```

New:
```tsx
<div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
  <span className="text-[11px] font-bold text-primary-foreground">D+</span>
</div>
<span className="text-sm font-semibold text-foreground">Distribuidor+</span>
```

- [ ] **Step 6: Verify build**

Run: `npm run build`
Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/layout/Sidebar.tsx
git commit -m "feat: Sidebar w-56, h-9 links, w-4 icons, text-sm per DS"
```

---

## Chunk 4: Pages

### Task 18: Update Dashboard Page

**Files:**
- Modify: `src/pages/Dashboard.tsx`

- [ ] **Step 1: Replace formatCurrency import**

Remove local `formatCurrency` function. Add import:

```ts
import { formatCurrency } from '@/lib/format'
```

- [ ] **Step 2: Remove inline Card styles**

Replace all occurrences of:
```tsx
className="rounded-md border border-border/50 shadow-none"
```
With just no className (Card defaults now handle it), or empty string if className prop is required.

For the 3-column card grid, remove `rounded-md border border-border/50 shadow-none` from each Card.

- [ ] **Step 3: Update spacing**

Replace `mt-3` (line 111) with `mt-6`.
Replace `gap-3 mt-4` (line 137) with `gap-4 mt-6`.

- [ ] **Step 4: Update skeleton cards**

Replace skeleton card inline styles similarly.

- [ ] **Step 5: Add animate-fade-in to main content**

Wrap the main return content:
```tsx
<div className="animate-fade-in">
```

- [ ] **Step 6: Verify build**

Run: `npm run build`
Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add src/pages/Dashboard.tsx
git commit -m "feat: Dashboard DS spacing, shared formatCurrency, remove inline card styles"
```

---

### Task 19: Update DistribuidoresList Page

**Files:**
- Modify: `src/pages/DistribuidoresList.tsx`

- [ ] **Step 1: Import FilterBar + FilterField**

Replace the filter Card/CardContent/label pattern with FilterBar:

```tsx
import { FilterBar, FilterField } from '@/components/distribuidor/FilterBar'
```

- [ ] **Step 2: Replace filter section**

Replace the filter Card (lines 58-111) with:

```tsx
<FilterBar>
  <FilterField label="Buscar">
    <div className="relative">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      <Input
        className="h-8 text-sm pl-8 placeholder:text-muted-foreground"
        placeholder="Nome, CNPJ ou cidade..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
    </div>
  </FilterField>
  <FilterField label="Estado">
    <Select value={estadoFilter} onValueChange={(v) => setEstadoFilter(v ?? 'todos')}>
      <SelectTrigger className="h-8 text-sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="todos">Todos os estados</SelectItem>
        {ESTADOS_NORDESTE.map((e) => (
          <SelectItem key={e.value} value={e.value}>
            {e.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </FilterField>
  <FilterField label="Status">
    <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? 'todos')}>
      <SelectTrigger className="h-8 text-sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="todos">Todos</SelectItem>
        <SelectItem value="ativo">Ativo</SelectItem>
        <SelectItem value="inativo">Inativo</SelectItem>
        <SelectItem value="em_analise">Em Analise</SelectItem>
      </SelectContent>
    </Select>
  </FilterField>
</FilterBar>
```

- [ ] **Step 3: Remove inline table/card styles**

Remove `rounded-md border border-border/50 shadow-none` from the table Card.
Remove `hover:bg-transparent border-border/50` from TableRow in header (Table component now handles defaults).
Remove `text-[10px] font-semibold uppercase tracking-wider text-muted-foreground py-2 h-8` from all TableHead (now in base component).
Remove `border-border/30` from TableRow — base handles `border-border/50`.

- [ ] **Step 4: Update icon sizes**

Replace `w-3 h-3` with `w-3.5 h-3.5` for table cell icons (MapPin, Phone, Mail).

- [ ] **Step 5: Add animate-fade-in**

Wrap main content in `<div className="animate-fade-in">`.

- [ ] **Step 6: Verify build**

Run: `npm run build`
Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add src/pages/DistribuidoresList.tsx
git commit -m "feat: DistribuidoresList uses FilterBar, DS table specs, animate-fade-in"
```

---

### Task 20: Update DistribuidorDetail Page

**Files:**
- Modify: `src/pages/DistribuidorDetail.tsx`

- [ ] **Step 1: Import shared formatCurrency**

Replace local `formatCurrency` with:
```ts
import { formatCurrency } from '@/lib/format'
```

Remove the local function definition.

- [ ] **Step 2: Remove inline Card/Table styles**

Remove all `rounded-md border border-border/50 shadow-none` from Cards.
Remove all `text-[10px] font-semibold uppercase tracking-wider text-muted-foreground py-2 h-8` from TableHead elements.
Remove all `hover:bg-transparent border-border/50` from header TableRow.
Remove all `hover:bg-muted/30 border-border/30` from body TableRow (base handles it).

- [ ] **Step 3: Update header spacing**

Change `mb-3` to `mb-6` in the header row.
Change `text-[10px]` to `text-[11px]` in the CNPJ span.

- [ ] **Step 4: Update tab trigger sizes**

Change tabs from `h-7 px-3` to `h-8 px-3`.

- [ ] **Step 5: Update section spacing**

Change `mt-4` to `mt-6` for the tabs section.
Change `mt-3` to `mt-4` for TabsContent.

- [ ] **Step 6: Add animate-fade-in**

Wrap main content in `<div className="animate-fade-in">`.

- [ ] **Step 7: Verify build**

Run: `npm run build`
Expected: No errors.

- [ ] **Step 8: Commit**

```bash
git add src/pages/DistribuidorDetail.tsx
git commit -m "feat: DistribuidorDetail shared format, DS spacing/typography, clean inline styles"
```

---

### Task 21: Update PerformanceList Page

**Files:**
- Modify: `src/pages/PerformanceList.tsx`

- [ ] **Step 1: Import shared formatCurrency + FilterBar**

```ts
import { formatCurrency } from '@/lib/format'
import { FilterBar, FilterField } from '@/components/distribuidor/FilterBar'
```

Remove local `formatCurrency`.

- [ ] **Step 2: Replace filter section with FilterBar**

Same pattern as DistribuidoresList — replace Card+CardContent+label with FilterBar+FilterField.

- [ ] **Step 3: Remove inline Card/Table styles**

Same cleanup as other pages.

- [ ] **Step 4: Update spacing: mt-4 → mt-6**

- [ ] **Step 5: Add animate-fade-in**

- [ ] **Step 6: Verify build**

Run: `npm run build`
Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add src/pages/PerformanceList.tsx
git commit -m "feat: PerformanceList FilterBar, shared format, DS styles"
```

---

### Task 22: Update ExcelenciaList Page

**Files:**
- Modify: `src/pages/ExcelenciaList.tsx`

- [ ] **Step 1: Remove inline Card/Table styles**

- [ ] **Step 2: Update spacing: mt-4 → mt-6**

- [ ] **Step 3: Add animate-fade-in**

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/pages/ExcelenciaList.tsx
git commit -m "feat: ExcelenciaList DS spacing, clean inline styles"
```

---

### Task 23: Update MetasPanel Page

**Files:**
- Modify: `src/pages/MetasPanel.tsx`

- [ ] **Step 1: Import shared formatCurrency + FilterBar**

```ts
import { formatCurrency } from '@/lib/format'
import { FilterBar, FilterField } from '@/components/distribuidor/FilterBar'
```

Remove local `formatCurrency`.

- [ ] **Step 2: Replace filter section with FilterBar**

- [ ] **Step 3: Remove inline Card styles**

- [ ] **Step 4: Update spacing: mt-4 → mt-6, mb-4 → mb-6**

- [ ] **Step 5: Add animate-fade-in**

- [ ] **Step 6: Verify build**

Run: `npm run build`
Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add src/pages/MetasPanel.tsx
git commit -m "feat: MetasPanel FilterBar, shared format, DS styles"
```

---

### Task 24: Update EstoquePanel Page

**Files:**
- Modify: `src/pages/EstoquePanel.tsx`

- [ ] **Step 1: Import FilterBar**

```ts
import { FilterBar, FilterField } from '@/components/distribuidor/FilterBar'
```

- [ ] **Step 2: Replace filter section with FilterBar**

- [ ] **Step 3: Remove inline Card/Table styles**

- [ ] **Step 4: Update spacing: mt-4 → mt-6, mb-4 → mb-6**

- [ ] **Step 5: Add animate-fade-in**

- [ ] **Step 6: Verify build**

Run: `npm run build`
Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add src/pages/EstoquePanel.tsx
git commit -m "feat: EstoquePanel FilterBar, DS spacing, clean inline styles"
```

---

### Task 25: Update IngestaoPanel Page

**Files:**
- Modify: `src/pages/IngestaoPanel.tsx`

- [ ] **Step 1: Remove inline Card styles**

Remove `rounded-md border border-border/50 shadow-none` from Card.

- [ ] **Step 2: Update spacing**

`mb-4` → `mb-6` on IngestaoUpload.

- [ ] **Step 3: Add animate-fade-in**

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/pages/IngestaoPanel.tsx
git commit -m "feat: IngestaoPanel DS spacing, clean inline styles"
```

---

## Chunk 5: Final Verification

### Task 26: Full Build + Visual Verification

- [ ] **Step 1: Full build**

Run: `npm run build`
Expected: Zero errors, zero warnings.

- [ ] **Step 2: Start dev server and visually verify**

Run: `npm run dev`

Check each page:
- Dashboard: Navy brand in sidebar, shadow on cards, text-lg KPI values, teal accent on Excelencia badge
- Distribuidores: FilterBar, table headers 11px uppercase, proper row spacing
- Detail: Tabs, semantic status badges, progress bars with success/warning/destructive
- Performance: FilterBar, ranking table
- Excelencia: Table, accent badges
- Metas: Progress bars, FilterBar
- Estoque: FilterBar, status badges
- Ingestao: Upload form, status feedback

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete Arruda Hub Design System v2 implementation"
```
