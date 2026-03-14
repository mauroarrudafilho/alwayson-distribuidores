# Arruda Hub Design System v2.0

**Stack:** React + TypeScript + Tailwind CSS v4 + shadcn/ui (Base UI) + Vite 7
**Color space:** OKLCH
**Ultima atualizacao:** Marco 2026

---

## Indice

1. [Visao Geral](#visao-geral)
2. [Principios de Design](#principios-de-design)
3. [Fundacao Tecnica](#fundacao-tecnica)
4. [Tokens de Design](#tokens-de-design)
   - [Cores de Marca](#cores-de-marca)
   - [Escala de Cinzas](#escala-de-cinzas)
   - [Cores de Status](#cores-de-status)
   - [Cores de Charts](#cores-de-charts)
   - [Tokens Semanticos](#tokens-semanticos)
   - [Tipografia](#tipografia)
   - [Espacamento](#espacamento)
   - [Border Radius](#border-radius)
   - [Sombras](#sombras)
   - [Animacoes](#animacoes)
5. [Modo Escuro](#modo-escuro)
6. [Componentes Base](#componentes-base)
   - [Button](#button)
   - [Badge](#badge)
   - [Card](#card)
   - [Input](#input)
7. [Patterns de Dashboard](#patterns-de-dashboard)
   - [KPI Card](#kpi-card)
   - [KPI Grid](#kpi-grid)
   - [Filter Bar](#filter-bar)
   - [Data Table](#data-table)
   - [Progress Indicator](#progress-indicator)
   - [Status Badge](#status-badge)
   - [Page Header](#page-header)
   - [Section Title](#section-title)
8. [Patterns de Estado](#patterns-de-estado)
   - [Loading / Skeleton](#loading--skeleton)
   - [Empty State](#empty-state)
   - [Error State](#error-state)
   - [Toast / Notification](#toast--notification)
9. [Layout & Responsive](#layout--responsive)
10. [Padroes de Uso](#padroes-de-uso)
11. [Configuracao em Novos Projetos](#configuracao-em-novos-projetos)

---

## Visao Geral

O **Arruda Hub Design System v2** e o sistema de design para produtos da plataforma Arruda Hub, voltado a aplicacoes comerciais B2B com foco em dashboards de dados e gestao operacional.

Combina uma identidade visual profissional (Navy + Teal) com componentes acessiveis e extensiveis, construidos sobre **shadcn/ui** (Base UI) e consumidos via **Tailwind CSS v4**.

### O que mudou da v1

| Aspecto | v1 | v2 |
|---------|----|----|
| Tailwind | v3 (config JS) | v4 (`@theme inline` + CSS nativo) |
| Color space | HSL | OKLCH (perceptually uniform) |
| Componentes base | Radix Slot | Base UI |
| Fonte | Inter | Geist Variable |
| Escala tipografica | Fixa | Dual: default + compact |
| Patterns de dashboard | Nenhum | KPI, Table, Filter, Chart |
| Animations | Accordion only | Fade, slide, skeleton shimmer |

---

## Principios de Design

| Principio | Descricao |
|-----------|-----------|
| **Sobriedade** | Paleta contida. Cores de status e accent sao usadas de forma controlada, nunca decorativa. |
| **Consistencia** | Todos os valores (cor, espaco, raio) vem de tokens. Nenhum valor "magico" no codigo. |
| **Acessibilidade** | Contraste minimo AA (4.5:1) em todos os pares foreground/background. Minimo tamanho de texto: 12px. |
| **Modo escuro nativo** | Todos os tokens possuem equivalente dark mode definido explicitamente. |
| **Composicao** | Componentes sao compostos e extensiveis via `className` e `cva` variants. |
| **Data-first** | Otimizado para dashboards: densidade controlada, tabular-nums, KPI patterns. |
| **Progressive disclosure** | Informacao critica visivel, detalhes acessiveis via interacao (hover, expand, drill-down). |

---

## Fundacao Tecnica

```
Projeto
├── src/index.css              # Variaveis CSS (fonte da verdade dos tokens)
├── src/lib/utils.ts           # Utilitario cn() (clsx + tailwind-merge)
├── src/components/ui/         # Biblioteca de componentes base (shadcn/ui)
├── src/components/{dominio}/  # Componentes de dominio (KPICard, StatusBadge, etc.)
└── .interface-design/
    └── system.md              # Este arquivo
```

**Dependencias obrigatorias:**

```json
{
  "tailwindcss": "^4",
  "tw-animate-css": "latest",
  "class-variance-authority": "latest",
  "clsx": "latest",
  "tailwind-merge": "latest",
  "@base-ui/react": "latest",
  "@fontsource-variable/geist": "latest"
}
```

---

## Tokens de Design

Todos os tokens sao variaveis CSS definidas em `src/index.css` usando OKLCH.

### Cores de Marca

Identidade visual institucional Arruda Hub.

| Token CSS | OKLCH | Hex aprox. | Uso |
|-----------|-------|------------|-----|
| `--navy` | `oklch(0.25 0.05 250)` | `#0A2342` | Cor primaria de marca. Botoes, headings, sidebar. |
| `--navy-hover` | `oklch(0.30 0.05 250)` | `#0E2D54` | Estado hover do Navy. |
| `--navy-light` | `oklch(0.35 0.05 250)` | `#133B6B` | Fundo de sidebar item ativo (dark mode). |
| `--teal` | `oklch(0.70 0.15 175)` | `#14B8A6` | Destaque secundario. Insights, badges de accent, sparklines. |
| `--teal-hover` | `oklch(0.65 0.15 175)` | `#0D9488` | Estado hover do Teal. |

**Uso do Teal (controlado):**
- Badges de tipo `accent`
- Indicadores de progresso de destaque
- Sparklines e chart accent
- **Nunca** em botoes de acao, textos corridos, ou como primaria concorrente ao Navy

**Gradiente institucional** (uso exclusivo para splash/marketing):
```css
background: linear-gradient(180deg, oklch(1 0 0) 0%, oklch(0.25 0.05 250) 100%);
```

---

### Escala de Cinzas

6 passos com leve matiz azulada para harmonizar com o Navy.

| Token CSS | OKLCH | Hex aprox. | Uso |
|-----------|-------|------------|-----|
| `--gray-50` | `oklch(0.98 0.005 250)` | `#F8FAFC` | Background de pagina |
| `--gray-100` | `oklch(0.96 0.005 250)` | `#F1F5F9` | Background de hover, muted |
| `--gray-200` | `oklch(0.91 0.005 250)` | `#E2E8F0` | Bordas, divisores, inputs |
| `--gray-400` | `oklch(0.70 0.01 250)` | `#94A3B8` | Placeholders, icones inativos |
| `--gray-600` | `oklch(0.50 0.02 250)` | `#475569` | Texto secundario, labels |
| `--gray-900` | `oklch(0.20 0.02 250)` | `#0F172A` | Texto principal |

---

### Cores de Status

Usadas **exclusivamente** para comunicar estados do sistema. Nunca como decoracao.

| Token CSS | OKLCH | Hex aprox. | Semantica |
|-----------|-------|------------|-----------|
| `--status-success` | `oklch(0.60 0.19 145)` | `#16A34A` | Sucesso, ativo, aprovado, meta atingida |
| `--status-warning` | `oklch(0.65 0.18 70)` | `#D97706` | Atencao, pendente, alerta, meta parcial |
| `--status-danger` | `oklch(0.55 0.22 25)` | `#DC2626` | Erro, falha, bloqueado, critico, ruptura |
| `--status-info` | `oklch(0.55 0.20 260)` | `#2563EB` | Informacao, em andamento, processando |

**Uso em backgrounds sutis:**
```html
<span class="bg-success/10 text-success" />
<span class="bg-warning/10 text-warning" />
<span class="bg-destructive/10 text-destructive" />
<span class="bg-info/10 text-info" />
```

---

### Cores de Charts

Paleta de 6 cores para data visualization, derivadas do Navy/Teal com boa distincao perceptual.

| Token CSS | OKLCH | Uso |
|-----------|-------|-----|
| `--chart-1` | `oklch(0.55 0.20 260)` | Primaria de chart (azul) |
| `--chart-2` | `oklch(0.70 0.15 175)` | Secundaria (teal) |
| `--chart-3` | `oklch(0.65 0.18 310)` | Terciaria (violeta) |
| `--chart-4` | `oklch(0.65 0.18 70)` | Quaternaria (amber) |
| `--chart-5` | `oklch(0.60 0.19 145)` | Quinaria (verde) |
| `--chart-6` | `oklch(0.55 0.22 25)` | Senaria (vermelho) |

Usar em sequencia para series de dados. Em charts com apenas 1 serie, usar `--chart-1`.

---

### Tokens Semanticos

Mapeiam cores de marca para papeis de interface. Componentes consomem **apenas** tokens semanticos.

#### Light Mode

| Token | Valor | Papel |
|-------|-------|-------|
| `--background` | gray-50 | Fundo da pagina |
| `--foreground` | gray-900 | Texto padrao |
| `--card` | white | Fundo de cards |
| `--card-foreground` | gray-900 | Texto em cards |
| `--primary` | navy | Cor primaria de acao |
| `--primary-foreground` | white | Texto sobre primaria |
| `--secondary` | white | Acao secundaria |
| `--secondary-foreground` | navy | Texto sobre secundaria |
| `--muted` | gray-100 | Fundo de elementos silenciados |
| `--muted-foreground` | gray-600 | Texto silenciado |
| `--accent` | teal | Cor de destaque |
| `--accent-foreground` | white | Texto sobre accent |
| `--border` | gray-200 | Bordas gerais |
| `--input` | gray-200 | Borda de inputs |
| `--ring` | navy | Foco (outline) |
| `--destructive` | status-danger | Acao destrutiva |
| `--success` | status-success | Estado de sucesso |
| `--warning` | status-warning | Estado de alerta |
| `--info` | status-info | Estado informativo |

#### Tokens de Sidebar

| Token | Light | Dark |
|-------|-------|------|
| `--sidebar-background` | white | navy escuro |
| `--sidebar-foreground` | navy | quase branco |
| `--sidebar-primary` | navy | quase branco |
| `--sidebar-accent` | gray-50 | navy medio |
| `--sidebar-border` | gray-200 | cinza escuro |

---

### Tipografia

**Fonte:** `Geist Variable` (via `@fontsource-variable/geist`). Fallback: `system-ui, sans-serif`.

#### Escala Default (paginas regulares)

| Classe Tailwind | Tamanho | Peso | Line Height | Uso |
|-----------------|---------|------|-------------|-----|
| `text-2xl` | 24px | 600 | 1.2 | Titulos de pagina (h1) |
| `text-lg` | 18px | 600 | 1.3 | Titulos de secao (h2) |
| `text-base` | 16px | 600 | 1.4 | Subtitulos, titulos de card (h3) |
| `text-sm` | 14px | 400 | 1.5 | Corpo de texto padrao |
| `text-xs` | 12px | 500 | 1.4 | Labels, metadados, captions |

#### Escala Compact (dashboards high-density)

| Classe Tailwind | Tamanho | Peso | Line Height | Uso |
|-----------------|---------|------|-------------|-----|
| `text-base` | 16px | 600 | 1.3 | Titulo de pagina |
| `text-sm` | 14px | 600 | 1.4 | Titulo de secao |
| `text-sm` | 14px | 400 | 1.5 | Corpo de texto |
| `text-xs` | 12px | 500 | 1.4 | Labels de campo, table headers |
| `text-[11px]` | 11px | 600 | 1.3 | KPI labels, badges, metadados compactos |

> **Regra:** Tamanho minimo absoluto e 11px. Nunca usar `text-[9px]` ou `text-[10px]`.

#### Numeros

Todos os valores numericos (KPIs, tabelas, moeda) devem usar:
```html
<span class="tabular-nums">R$ 1.234.567</span>
```

#### Feature settings
```css
font-feature-settings: "rlig" 1, "calt" 1;
```

---

### Espacamento

Sistema baseado na escala de 4px do Tailwind. Valores padrao por contexto:

#### Spacing Scale

| Contexto | Classe | Valor | Quando usar |
|----------|--------|-------|-------------|
| Entre secoes de pagina | `gap-6` / `space-y-6` | 24px | Separar blocos logicos (KPIs, tabelas) |
| Entre cards em grid | `gap-4` | 16px | Grid de KPI cards, cards lado a lado |
| Entre elementos de form | `space-y-4` | 16px | Campos de formulario |
| Padding interno de card | `p-4` | 16px | Padrao |
| Padding interno de card compact | `p-3` | 12px | Apenas em KPI cards (high density) |
| Padding de pagina | `p-6` | 24px | Conteudo principal |
| Gap entre icone e label | `gap-2` | 8px | Botoes, sidebar items, KPI labels |
| Table cell padding | `py-2.5 px-3` | 10px/12px | Rows de tabela legiveis |

> **Regra:** Nunca usar espacamento arbitrario. Sempre usar a escala: 0, 0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8.

---

### Border Radius

| Token | Valor | Classe Tailwind | Uso |
|-------|-------|-----------------|-----|
| `--radius` | `0.5rem` (8px) | `rounded-md` | Botoes, inputs, badges, chips |
| `--radius-lg` | `0.75rem` (12px) | `rounded-lg` | Cards, modais, containers |
| `--radius-sm` | `0.375rem` (6px) | `rounded-sm` | Elementos internos pequenos, badge compacta |

> **Regra:** Cards sempre `rounded-lg`. Botoes e inputs sempre `rounded-md`. Badges `rounded-sm`.

---

### Sombras

Sistema de 3 niveis de profundidade.

| Token | CSS | Uso |
|-------|-----|-----|
| `shadow-card` | `0 1px 3px oklch(0 0 0 / 8%), 0 1px 2px oklch(0 0 0 / 6%)` | Estado padrao de cards |
| `shadow-card-hover` | `0 4px 6px oklch(0 0 0 / 8%), 0 2px 4px oklch(0 0 0 / 6%)` | Hover de cards interativos |
| `shadow-elevated` | `0 10px 15px oklch(0 0 0 / 10%), 0 4px 6px oklch(0 0 0 / 5%)` | Modais, popovers, dropdowns |

> **Regra:** Todo card tem `shadow-card`. Cards interativos adicionam `hover:shadow-card-hover transition-shadow`. Nunca `shadow-none` em cards.

---

### Animacoes

| Token | Duracao | Easing | CSS | Uso |
|-------|---------|--------|-----|-----|
| `animate-fade-in` | 200ms | ease-out | `opacity 0→1, translateY -8px→0` | Entrada de paginas, cards |
| `animate-slide-in` | 200ms | ease-out | `translateX -16px→0, opacity 0→1` | Entrada de sidebar, panels |
| `animate-scale-in` | 150ms | ease-out | `scale 0.95→1, opacity 0→1` | Entrada de modais, popovers |
| `animate-skeleton` | 1.5s | ease-in-out | `opacity 0.5→1→0.5` (infinite) | Shimmer de skeleton |
| `transition-colors` | 150ms | ease | — | Hover de botoes, links, rows |
| `transition-shadow` | 200ms | ease | — | Hover de cards |

> **Regra:** Toda entrada de conteudo apos loading deve usar `animate-fade-in`. Skeletons usam `animate-skeleton` (pulse).

---

## Modo Escuro

Ativado pela classe `.dark` no elemento raiz. Configurado via `@custom-variant dark (&:is(.dark *))` no Tailwind v4.

### Inversao de tokens

| Token | Light | Dark |
|-------|-------|------|
| `--background` | gray-50 | gray-900 |
| `--foreground` | gray-900 | gray-50 |
| `--card` | white | `oklch(0.22 0.02 250)` |
| `--primary` | navy | white |
| `--primary-foreground` | white | navy |
| `--muted` | gray-100 | `oklch(0.25 0.02 250)` |
| `--muted-foreground` | gray-600 | gray-400 |
| `--border` | gray-200 | `oklch(1 0 0 / 12%)` |
| `--accent` | teal | teal (inalterado) |
| `--sidebar-background` | white | `oklch(0.18 0.03 250)` |

> **Regra:** Sempre use tokens semanticos (`bg-background`, `text-foreground`, `border-border`). Nunca aplique cores de marca diretamente (ex: `bg-[#0A2342]`).

---

## Componentes Base

### Button

**Variantes:**

| Variant | Aparencia | Uso |
|---------|-----------|-----|
| `default` | Fundo navy, texto branco | Acao primaria principal |
| `outline` | Borda border, fundo background | Acao secundaria |
| `secondary` | Fundo muted, texto foreground | Alternativa ao outline |
| `ghost` | Sem fundo, texto foreground | Acao terciaria, menus |
| `destructive` | Fundo danger/10, texto danger | Acao irreversivel |
| `link` | Texto primary com underline | Links inline |

**Tamanhos:**

| Size | Altura | Uso |
|------|--------|-----|
| `default` | 36px (`h-9`) | Padrao geral |
| `sm` | 32px (`h-8`) | Espacos compactos, toolbars |
| `lg` | 40px (`h-10`) | CTAs de destaque |
| `icon` | 36x36 | Botoes apenas com icone |
| `icon-sm` | 28x28 | Icones em toolbar compact |

**Hierarquia de acoes:**
```
Acao principal   → <Button variant="default">
Acao secundaria  → <Button variant="outline">
Acao terciaria   → <Button variant="ghost">
Acao destrutiva  → <Button variant="destructive">
```
Nunca use dois botoes `default` lado a lado na mesma area.

---

### Badge

**Variantes:**

| Variant | Aparencia | Uso |
|---------|-----------|-----|
| `default` | Fundo navy solido, texto branco | Rotulos de item padrao |
| `secondary` | Fundo muted, texto muted-foreground | Informacao neutra |
| `outline` | Borda border, fundo transparente | Rotulo discreto |
| `success` | Fundo success/10, texto success, borda success/20 | Ativo, aprovado, concluido |
| `warning` | Fundo warning/10, texto warning, borda warning/20 | Pendente, atencao |
| `destructive` | Fundo danger/10, texto danger, borda danger/20 | Erro, bloqueado, cancelado |
| `info` | Fundo info/10, texto info, borda info/20 | Em andamento, processando |
| `accent` | Fundo teal/10, texto teal, borda teal/20 | Insights, destaques especiais |

**Especificacoes:**
- `rounded-sm` (6px) — nunca `rounded-full`
- `text-[11px] font-semibold`
- `px-2 py-0.5`
- Sempre com `border` sutil (20% opacity)

---

### Card

**Especificacoes base:**
- `rounded-lg` (12px)
- `border border-border`
- `bg-card`
- `shadow-card`
- Padding interno: `p-4`

**Card interativo:**
```html
<Card class="hover:shadow-card-hover transition-shadow cursor-pointer">
```

**Anatomia:**
```
Card
├── CardHeader (p-4 pb-2)
│   ├── CardTitle      (text-sm font-semibold text-foreground)
│   └── CardDescription (text-xs text-muted-foreground)
├── CardContent (p-4 pt-0)
└── CardFooter (p-4 pt-0)
```

---

### Input

**Especificacoes:**
- Altura padrao: `h-9` (36px)
- Altura compact: `h-8` (32px) — apenas em filter bars
- Borda: `border border-border`
- Foco: `focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:border-primary`
- Radius: `rounded-md` (8px)
- Texto: `text-sm`
- Placeholder: `text-muted-foreground`

---

## Patterns de Dashboard

### KPI Card

Card compacto para metricas-chave. Usa a escala compact.

**Anatomia:**
```
KPICard (Card com p-3)
├── Header row (flex between)
│   ├── Icon (w-4 h-4) + Label (text-[11px] uppercase tracking-wider text-muted-foreground font-semibold)
│   └── Badge (opcional, variant="secondary")
├── Value row
│   ├── Value (text-lg font-bold tabular-nums text-foreground)
│   └── Trend (text-xs font-semibold, text-success ou text-destructive)
└── Subtitle (text-xs text-muted-foreground, opcional)
```

**Variantes:**
- `default`: border-border, bg-card
- `primary`: border-primary/20, bg-primary/5

**Tamanho de icone:** `w-4 h-4` (16px) para KPIs. Nunca menor.

**Grid:**
```html
<div class="grid grid-cols-2 md:grid-cols-4 gap-4">
  <KPICard ... />
</div>
```

---

### KPI Grid

Wrapper responsivo para KPI cards.

| Colunas | Classe | Uso |
|---------|--------|-----|
| 2 | `grid-cols-1 sm:grid-cols-2` | Secoes estreitas |
| 3 | `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` | Detail views |
| 4 | `grid-cols-2 md:grid-cols-4` | Dashboard principal |

Gap fixo: `gap-4` (16px).

---

### Filter Bar

Card de filtros no topo de paginas de listagem.

**Anatomia:**
```
Card (p-4)
└── Grid (grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4)
    └── FilterField
        ├── Label (text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5)
        └── Input/Select (h-8 text-sm)
```

**Regras:**
- Sempre dentro de um Card com `shadow-card`
- Labels sempre uppercase, tracking-wider
- Inputs compact (`h-8`) neste contexto
- Maximo 4 filtros visiveis. Mais que 4 → colapsar em "Mais filtros"

---

### Data Table

**Especificacoes de Table Header:**
```html
<TableHead class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground py-2.5 h-9">
```

**Especificacoes de Table Row:**
```html
<TableRow class="hover:bg-muted/50 border-border/50 transition-colors">
  <TableCell class="py-2.5 px-3 text-sm">
```

**Regras:**
- Headers sempre `uppercase tracking-wider`
- Valores numericos: `tabular-nums text-right`
- Links em cells: `text-foreground hover:text-primary font-medium`
- Rows interativas: `cursor-pointer hover:bg-muted/50`
- Minimum row height: `h-10` (40px) para touch targets
- Tabela sempre dentro de um Card com `shadow-card`
- Colunas de acao (botoes/links): alinhadas a direita

**Sorting (futuro):**
- Headers sortaveis: `cursor-pointer hover:text-foreground`
- Indicador: chevron icon `w-3 h-3` ao lado do label

**Pagination:**
- Sempre que > 20 rows
- Posicao: abaixo da tabela, dentro do mesmo Card
- Pattern: "Mostrando X-Y de Z" + botoes Anterior/Proximo

---

### Progress Indicator

Barra de progresso para metas/KPIs.

**Anatomia:**
```
ProgressIndicator
├── Header (flex between)
│   ├── Label (text-sm font-medium text-foreground)
│   └── Percentage (text-sm font-bold tabular-nums, cor semantica)
├── Bar (h-2 rounded-full bg-muted)
│   └── Fill (rounded-full, cor semantica)
└── Footer (flex between, text-xs text-muted-foreground)
    ├── "Realizado: X"
    └── "Meta: Y"
```

**Cores por percentual:**
- >= 100%: `success`
- >= 70%: `warning`
- < 70%: `destructive`

**Regras:**
- Altura da barra: `h-2` (8px) — nunca menor que 6px
- Sempre com label + valor numerico. Nunca barra sozinha.
- Usar apenas o fill customizado OU o Progress nativo, nunca ambos sobrepostos.

---

### Status Badge

Badge semantica para estados de entidades.

**Mapeamento de status para Badge variant:**

| Status | Badge variant | Label |
|--------|---------------|-------|
| `ativo` / `normal` / `concluido` | `success` | Ativo / Normal / Concluido |
| `em_analise` / `processando` | `info` | Em Analise / Processando |
| `em_risco` / `baixo` / `pendente` | `warning` | Em Risco / Baixo / Pendente |
| `inativo` | `secondary` | Inativo |
| `critico` / `ruptura` / `erro` | `destructive` | Critico / Ruptura / Erro |
| `excelencia` | `accent` | Excelencia |

**Regras:**
- Usa as variants do Badge (nunca hardcode colors)
- Cada status DEVE incluir um dot indicator ou icone alem da cor (acessibilidade)
- Tamanho: `text-[11px]`

---

### Page Header

**Anatomia:**
```
PageHeader (flex between, mb-6)
├── Left
│   ├── Title (text-lg font-semibold text-foreground)
│   └── Description (text-sm text-muted-foreground mt-1)
└── Right
    └── Actions (flex gap-2)
```

---

### Section Title

**Anatomia:**
```
SectionTitle (flex items-center gap-2, mb-3)
├── Icon (w-4 h-4 text-muted-foreground)
└── Text (text-xs font-semibold uppercase tracking-wider text-muted-foreground)
```

---

## Patterns de Estado

### Loading / Skeleton

**Regras:**
- Skeletons devem espelhar o layout final (mesmas dimensoes aproximadas)
- Usar `animate-pulse` (built-in Tailwind)
- Background: `bg-muted`
- Border radius: igual ao elemento que substitui
- Duracao minima de loading: 200ms (evitar flash)

**Skeleton de KPI Card:**
```html
<Card class="shadow-card">
  <CardContent class="p-3">
    <Skeleton class="h-3.5 w-24 mb-2" />
    <Skeleton class="h-6 w-16" />
  </CardContent>
</Card>
```

**Skeleton de Table Row:**
```html
<TableRow>
  <TableCell class="py-2.5"><Skeleton class="h-4 w-32" /></TableCell>
  ...
</TableRow>
```

---

### Empty State

**Anatomia:**
```
EmptyState (flex flex-col items-center py-12)
├── Icon (w-12 h-12 text-muted-foreground/30)
├── Title (text-sm font-medium text-foreground mt-4)
├── Description (text-xs text-muted-foreground mt-1 max-w-sm text-center)
└── Action (Button variant="outline" size="sm", mt-4, opcional)
```

**Regras:**
- Sempre dentro do container que estaria preenchido (card, table)
- Icone grande mas com baixa opacidade (nao dominar)
- Mensagem concisa: o que esta faltando + como resolver
- CTA opcional para criar o primeiro item

---

### Error State

Similar ao Empty State, mas com icone de alerta e cor destructive.

```html
<div class="text-center py-12">
  <AlertCircle class="w-12 h-12 text-destructive/30 mx-auto" />
  <p class="text-sm font-medium text-foreground mt-4">Erro ao carregar dados</p>
  <p class="text-xs text-muted-foreground mt-1">Tente novamente em alguns instantes</p>
  <Button variant="outline" size="sm" class="mt-4">Tentar novamente</Button>
</div>
```

---

### Toast / Notification

Para feedback de acoes (upload, save, delete).

**Regras:**
- Posicao: bottom-right
- Duracao: 5 segundos (auto-dismiss)
- Variantes: success, error, warning, info
- Sempre com icone + texto
- Acao de dismiss (X)

---

## Layout & Responsive

### Container

```html
<main class="flex-1 overflow-auto">
  <div class="p-6 max-w-[1400px] mx-auto">
    <!-- conteudo -->
  </div>
</main>
```

- Padding de pagina: `p-6` (24px)
- Max-width: `1400px`
- Em mobile (< 640px): `p-4` (16px)

### Sidebar

- Width expandida: `w-56` (224px)
- Width colapsada: `w-14` (56px)
- Em mobile (< 768px): drawer overlay (Sheet) em vez de collapse

### Breakpoints

| Breakpoint | Valor | Uso |
|------------|-------|-----|
| `sm` | 640px | Filtros em 2 colunas, KPIs em 2 colunas |
| `md` | 768px | Sidebar visivel, KPIs em 3-4 colunas |
| `lg` | 1024px | Layout completo, tabelas com todas as colunas |
| `xl` | 1280px | Espacamento extra |

### Tabelas em Mobile

- Scroll horizontal com `overflow-x-auto`
- Colunas de prioridade baixa: `hidden md:table-cell`
- Alternativa: card view em mobile, table em desktop

---

## Padroes de Uso

### Cores em Contexto
```
Texto principal         → text-foreground
Texto secundario        → text-muted-foreground
Texto de titulo         → text-foreground (com font-semibold)
Texto de link           → text-foreground hover:text-primary font-medium
Texto de destaque KPI   → text-foreground (com text-lg font-bold)
```

> **Nota:** Na v2, titulos usam `text-foreground` (nao `text-primary`). O Navy como cor de texto e reservado para o dark mode quando primary inverte para branco.

### Icones
```
KPI icons        → w-4 h-4
Sidebar icons    → w-4 h-4
Button icons     → w-4 h-4
Table cell icons → w-3.5 h-3.5
```
Biblioteca: Lucide React.

### Utility: formatCurrency

Definir **uma unica vez** em `src/lib/format.ts`:
```ts
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}
```
Nunca duplicar essa funcao entre paginas.

---

## Configuracao em Novos Projetos

### 1. Instalar dependencias

```bash
npm install tailwindcss@^4 tw-animate-css class-variance-authority clsx tailwind-merge
npm install @base-ui/react @fontsource-variable/geist
```

### 2. Configurar tokens

Copiar `src/index.css` com todos os tokens OKLCH definidos em `:root` e `.dark`.

### 3. Estrutura minima

```tsx
import "@fontsource-variable/geist";
import "./index.css";

<div class="bg-background text-foreground min-h-screen font-sans">
  {/* conteudo */}
</div>
```

### 4. Adicionar componentes

```bash
npx shadcn@latest init
npx shadcn@latest add button badge card input table tabs
```

Apos adicionar, substituir o `index.css` pelos tokens deste design system.

### 5. Verificar checklist

- [ ] Todos os tokens semanticos definidos (light + dark)
- [ ] Fonte Geist carregando
- [ ] `shadow-card` em todo Card
- [ ] Nenhuma cor hardcoded nos componentes
- [ ] `tabular-nums` em valores numericos
- [ ] Minimo `text-[11px]` em qualquer texto
- [ ] Dark mode funcional

---

*Arruda Hub Design System v2.0 — mantido pela equipe de produto Arruda Hub.*
