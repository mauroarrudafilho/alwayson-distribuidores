# Design Spec: Alta Densidade e Utilitário

> **Objetivo:** Documento de referência para agentes implementarem o design system de alta densidade no `main`, sem alterar regras de negócio. Foco exclusivo em **design visual e layout**.

**Referência:** Implementação em `feature/erp-v2-ux` (commit `f907a58`).

---

## 1. Princípios do Design

| Princípio | Descrição |
|-----------|-----------|
| **Dados em primeiro lugar** | Remover sombras grandes, gradientes e elementos decorativos que competem com o conteúdo |
| **Alta densidade** | Reduzir padding, font-size e gaps para exibir mais informação na tela |
| **Utilitário** | Visual limpo, sem ornamentação; bordas sutis, cores semânticas discretas |
| **Consistência** | Mesmos padrões em Cards, Badges, Inputs e tabelas em todo o admin |

---

## 2. Tokens de Design

### 2.1 Espaçamento

| Contexto | Antes | Depois |
|----------|-------|--------|
| Card padding | `p-4`, `pt-4 pb-4`, `pt-6` | `p-3`, `p-4` (máx) |
| Grid gap | `gap-4`, `gap-6` | `gap-2`, `gap-3` |
| Section margin | `mb-6`, `mb-8` | `mb-4`, `mb-6` |
| Input height | padrão (h-10) | `h-8` |
| Sidebar header | `px-4 py-4` | `px-3 py-3` |
| Menu item height | padrão | `h-8` |

### 2.2 Tipografia

| Elemento | Classes |
|----------|---------|
| Título de seção | `text-xs font-semibold uppercase tracking-wider text-muted-foreground` |
| Label de formulário | `text-[10px] font-semibold uppercase tracking-wider text-muted-foreground` |
| Valor principal (KPI) | `text-sm font-bold` ou `text-xl font-semibold tracking-tight` |
| Texto secundário | `text-xs text-muted-foreground` ou `text-[10px]` |
| Badge numérico | `text-[9px]` ou `text-[10px]` |

### 2.3 Ícones

| Contexto | Tamanho |
|----------|---------|
| Menu sidebar | `w-3.5 h-3.5` |
| KPI / Card header | `w-3 h-3` ou `w-4 h-4` |
| Botões compactos | `w-3.5 h-3.5` |
| Input prefix (Search) | `w-3.5 h-3.5` |

### 2.4 Bordas e Sombras

| Elemento | Classes |
|----------|---------|
| Card | `border border-border/50 rounded-md shadow-none` |
| Card hover | `hover:border-border/80` |
| Input / Select | `shadow-none border-border/50` |
| Badge | `rounded-sm` (em vez de `rounded-full` para badges numéricos) |

---

## 3. Padrões por Componente

### 3.1 Cards (KPI, métricas, resumos)

```tsx
// Padrão aplicado
<Card className="rounded-md border border-border/50 bg-card hover:border-border/80 transition-colors shadow-none">
  <CardContent className="p-3">
    <div className="flex items-center justify-between gap-2 text-muted-foreground text-[10px] font-semibold uppercase tracking-wider mb-1.5">
      <span className="flex items-center gap-1.5 truncate">
        <Icon className="h-3 w-3 shrink-0" />
        <span className="truncate">{label}</span>
      </span>
      {badge && <Badge variant="secondary" className="h-4 px-1 text-[9px] font-bold rounded-sm shrink-0">{badge}</Badge>}
    </div>
    <div className="text-sm font-bold tabular-nums text-foreground">
      {value}
    </div>
    {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
  </CardContent>
</Card>
```

### 3.2 Badges de Status (Pedidos, Documentos)

- **Remover:** gradientes (`bg-gradient-to-br`), sombras (`shadow-md`), `ring-2`
- **Aplicar:** cores sólidas ou sutis com borda

```tsx
// Exemplo: status confirmado
className="bg-emerald-500 text-white border-emerald-600 font-semibold shadow-sm"

// Exemplo: status neutro
className="bg-slate-100 text-slate-700 border-slate-300"

// Exemplo: status cancelado
className="bg-red-50 text-red-700 border-red-200 line-through decoration-red-300/50"
```

### 3.3 Formulários e Filtros

- **Input:** `h-8 text-xs shadow-none border-border/50`
- **SelectTrigger:** `h-8 text-xs shadow-none border-border/50`
- **Button (outline/sm):** `h-8 text-xs shadow-none border-border/50`
- **Labels:** `text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block`
- **Grid de filtros:** `gap-3` em vez de `gap-4`

### 3.4 Sidebar (AdminSidebar)

- **Header:** `px-3 py-3`, logo compacto `w-6 h-6` ou `w-7 h-7`
- **Menu items:** `h-8 text-xs rounded-md`
- **Active state:** `bg-muted font-medium text-foreground` (sem `bg-sidebar-accent`)
- **Inactive:** `text-muted-foreground hover:bg-muted/50 hover:text-foreground`
- **Ícone ativo:** `text-primary`
- **Badge (pedidos/clientes):** `min-w-[16px] h-[16px] px-1 text-[9px] rounded-md bg-primary` (sem gradiente/sombra)

### 3.5 Quick Access / Atalhos

```tsx
<div className="flex items-center gap-2 px-3 py-2 rounded-md border border-border/50 bg-card hover:bg-muted/50 transition-colors shadow-none">
  <Icon className="w-4 h-4 text-primary" />
  <span className="text-xs font-medium text-foreground">{title}</span>
</div>
```

### 3.6 Tabelas

- Células com `py-2` ou `py-1.5` (reduzir padding vertical)
- Header: `text-[10px] font-semibold uppercase tracking-wider text-muted-foreground`
- Células: `text-xs` ou `text-sm`

---

## 4. Componentes e Páginas Afetados

### Dashboard
- `DashboardKPIGrid` — Cards compactos, grid `gap-3`
- `DashboardQuickAccess` — Chips compactos `gap-2`, `px-3 py-2`
- `DashboardAlerts` — Cards `p-3`, labels `text-xs`
- `DashboardHeader` — Header mais compacto
- `DashboardActivity` — Lista compacta
- `DashboardPendencias` — Mesmo padrão de cards

### Navegação
- `AdminSidebar` — Ver seção 3.4
- `AdminLayout` — Ajustes de padding se necessário

### Listagens
- `OrdersList` — KPIs em cards, status badges, grid `gap-2`
- `InvoicesList` — Card de filtros, inputs `h-8`
- `PricingList`, `SupplierManagement` — Padrão de cards e tabelas

### Detalhes / Formulários
- `ClientDetail`, `ClientManagement`
- `OrderDetail`, `InvoiceDetail`
- `PricingDetail`, `PricingSimulator`
- `FormacaoCarga`, `FlexTracker`, `ContaCorrente`
- `GestaoMetas`, `CommissionExtract`, `CommissionRules`
- `TeamManagement`

### Componentes compartilhados
- `DocumentKPIs` — Padrão de KPI cards
- `DocumentCard` — Card compacto
- `PageHeader` — Manter ou ajustar `gap-4` para `gap-3`

---

## 5. Exemplos Antes/Depois

### Card KPI

**Antes:**
```tsx
<Card className="border-primary/30 bg-primary/5">
  <CardContent className="pt-4 pb-4">
    <div className="flex items-center justify-between gap-2 text-muted-foreground text-xs font-medium mb-1">
      <span className="flex items-center gap-2">
        <Wallet className="h-3.5 w-3.5" />
        Total em carteira
      </span>
      <Badge variant="secondary" className="tabular-nums font-semibold">42</Badge>
    </div>
    <div className="text-lg font-bold tabular-nums">R$ 1.234.567</div>
  </CardContent>
</Card>
```

**Depois:**
```tsx
<Card className="border-primary/20 bg-primary/5 shadow-none rounded-md">
  <CardContent className="p-3">
    <div className="flex items-center justify-between gap-2 text-muted-foreground text-[10px] font-semibold uppercase tracking-wider mb-1.5">
      <span className="flex items-center gap-1.5 truncate">
        <Wallet className="h-3 w-3 shrink-0" />
        <span className="truncate">Total em Carteira</span>
      </span>
      <Badge variant="secondary" className="h-4 px-1 text-[9px] font-bold rounded-sm shrink-0">42</Badge>
    </div>
    <div className="text-sm font-bold tabular-nums text-foreground">R$ 1.234.567</div>
  </CardContent>
</Card>
```

### Label de filtro

**Antes:**
```tsx
<label className="text-sm font-medium mb-2 block">Data de Emissão (De)</label>
```

**Depois:**
```tsx
<label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Emissão (De)</label>
```

### Badge de status (Pedido Autorizado)

**Antes:**
```tsx
className="bg-green-200/10 text-green-600 border-green-200/20"
```

**Depois:**
```tsx
className="bg-emerald-500 text-white border-emerald-600 font-semibold shadow-sm"
```

---

## 6. Checklist de Implementação (para agentes)

- [ ] **Dashboard** — KPIGrid, QuickAccess, Alerts, Activity, Pendencias
- [ ] **AdminSidebar** — Header, menu items, badges, ícones
- [ ] **OrdersList** — KPIs, status badges, grid
- [ ] **InvoicesList** — Filtros, DocumentKPIs
- [ ] **PricingList / PricingDetail / PricingSimulator**
- [ ] **ClientManagement / ClientDetail**
- [ ] **SupplierManagement**
- [ ] **TeamManagement**
- [ ] **FormacaoCarga**
- [ ] **FlexTracker**
- [ ] **ContaCorrente**
- [ ] **GestaoMetas** (tabs)
- [ ] **CommissionExtract / CommissionRules**
- [ ] **AnalyticsDashboard** (KPICards, charts)
- [ ] **DocumentKPIs, DocumentCard**
- [ ] **Inputs e Selects** — `h-8 text-xs shadow-none border-border/50` onde aplicável

---

## 7. O que NÃO alterar

- Regras de negócio e fluxos
- Estrutura de dados e APIs
- Lógica de filtros, paginação, ordenação
- Comportamento de modais e diálogos (apenas ajustes visuais de padding/tipografia)
- Imports e organização de código (manter estrutura existente)

---

*Documento gerado para guiar implementação incremental do design de alta densidade no branch `main`.*
