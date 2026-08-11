# Performance — Evolução, Etapa 1 (leitura macro)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar o recorte de mês único da Performance por uma janela temporal, entregando faixa de topo com variação contra o ano anterior e gráfico de série com o ano anterior sobreposto.

**Architecture:** A série mensal passa a vir de uma view agregada no Postgres (`alwayson_faturamento_v_mensal`, ~1.067 linhas contra 24.389 itens), consumida por um hook novo. As tabelas hierárquicas continuam lendo linha a linha via `loadFaturamentoSales`, agora com intervalo em vez de mês — o que exige paralelizar o fetch de SKUs, hoje sequencial.

**Tech Stack:** React 19 + Vite, TanStack Query, Recharts 3.8, Supabase (projeto `osukbalwykbqvoumddxz`), Tailwind + shadcn/ui.

## Global Constraints

- **Sem framework de teste neste repo.** Não existe vitest/jest nem nenhum `*.test.*`. Não crie um. A verificação de cada task é: SQL contra o banco (via MCP Supabase ou SQL Editor), `npx tsc -b --noEmit`, e `npm run dev` + browser. Cada task abaixo traz os comandos e o resultado esperado.
- **Projeto Supabase:** ref `osukbalwykbqvoumddxz`. Confirme no dashboard antes de qualquer DDL. Nunca `kgzybpelluftexrewyke`.
- **Nunca expor UUID na UI.** Rótulo resolvido com `labelFromOptions()` (`src/lib/entity-labels.ts`), passado explicitamente como filho de `<SelectValue>`.
- **Views novas nascem com `WITH (security_invoker = true)`** e carregam **os dois eixos** (`distribuidor_id` + `fornecedor_tenant_id`). Sem o eixo de fornecedor a linha some para não-admin pela falha fechada do `NULL IN (...)` (migrations `048`/`049`).
- **`clientes_positivados` e `skus_distintos` não somam.** O total do distribuidor é sempre calculado, nunca derivado da soma dos vendedores. Em junho/2026: positivados 522 (somados dariam 523), SKUs 35 (somados dariam 562).
- **Commits em português**, seguindo o padrão do repo (`feat(escopo):`, `fix(escopo):`), terminando com `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- **Spec de origem:** `docs/superpowers/specs/2026-08-11-performance-evolucao-design.md`.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `docs/migrations/067_faturamento_mensal_agregado.sql` (criar) | A view agregada |
| `src/lib/loadFaturamentoSales.ts` (modificar) | Paralelizar o fetch de SKUs |
| `src/types/faturamento-mensal.ts` (criar) | Tipo da linha da view |
| `src/hooks/useFaturamentoMensal.ts` (criar) | Query da série + derivação da janela e do comparativo |
| `src/lib/janela-periodo.ts` (criar) | Cálculo de janela e do par de comparação — puro, sem React |
| `src/pages/performance/usePerfFilters.ts` (modificar) | `janela` e `comparar` na URL; `periodoInicio/Fim` derivados |
| `src/pages/Performance.tsx` (modificar) | Filtros `JANELA` e `COMPARAR COM` |
| `src/pages/performance/EvolucaoResumo.tsx` (criar) | Faixa de topo com variação |
| `src/pages/performance/EvolucaoGrafico.tsx` (criar) | Série com o ano anterior sobreposto |
| `src/pages/performance/DistribuidorTab.tsx` (modificar) | Montar os dois componentes novos acima da tabela |

---

### Task 1: View mensal agregada

**Files:**
- Create: `docs/migrations/067_faturamento_mensal_agregado.sql`

**Interfaces:**
- Produces: view `alwayson_faturamento_v_mensal` com colunas `distribuidor_id uuid`, `fornecedor_tenant_id uuid`, `vendedor_id uuid` (NULL na linha de total), `eh_total_distribuidor boolean`, `mes date` (primeiro dia do mês), `faturamento numeric`, `nfs bigint`, `clientes_positivados bigint`, `skus_distintos bigint`.

- [ ] **Step 1: Escrever a migration**

Crie `docs/migrations/067_faturamento_mensal_agregado.sql`. Este SQL foi validado contra o banco em 2026-08-11 — o join de itens está isolado num CTE próprio de propósito: juntá-lo ao cálculo de faturamento multiplicaria `valor_total` pelo número de itens da nota.

```sql
-- 067: série mensal agregada de faturamento, para a Performance por evolução.
--
-- Por que uma view: a tela precisa de 12–24 meses. Carregar nota a nota são
-- 7.314 NFs e ~16 mil itens só para 12 meses; aqui são ~1.067 linhas no total.
--
-- GROUPING SETS e não uma linha por vendedor: `clientes_positivados` e
-- `skus_distintos` NÃO são aditivos. Em junho/2026 o distribuidor tem 522
-- positivados e 35 SKUs; somar as 54 linhas de vendedor daria 523 e 562.
-- O total tem de ser calculado, nunca derivado.

DROP VIEW IF EXISTS alwayson_faturamento_v_mensal;

CREATE VIEW alwayson_faturamento_v_mensal
WITH (security_invoker = true) AS
WITH base AS (
  SELECT
    f.id,
    f.distribuidor_id,
    f.fornecedor_tenant_id,
    f.vendedor_id,
    f.cliente_id,
    f.numero_nf,
    f.valor_total,
    date_trunc('month', f.data_emissao)::date AS mes
  FROM alwayson_faturamento f
),
notas AS (
  SELECT
    distribuidor_id,
    fornecedor_tenant_id,
    mes,
    vendedor_id,
    GROUPING(vendedor_id) AS g,
    sum(valor_total)              AS faturamento,
    count(DISTINCT numero_nf)     AS nfs,
    count(DISTINCT cliente_id)    AS clientes_positivados
  FROM base
  GROUP BY GROUPING SETS (
    (distribuidor_id, fornecedor_tenant_id, mes, vendedor_id),
    (distribuidor_id, fornecedor_tenant_id, mes)
  )
),
-- CTE separado: o join com itens fan-out uma linha por SKU. Se ele entrasse
-- no cálculo acima, `sum(valor_total)` viria multiplicado.
skus AS (
  SELECT
    b.distribuidor_id,
    b.fornecedor_tenant_id,
    b.mes,
    b.vendedor_id,
    GROUPING(b.vendedor_id) AS g,
    count(DISTINCT i.sku) AS skus_distintos
  FROM base b
  JOIN alwayson_faturamento_itens i ON i.faturamento_id = b.id
  GROUP BY GROUPING SETS (
    (b.distribuidor_id, b.fornecedor_tenant_id, b.mes, b.vendedor_id),
    (b.distribuidor_id, b.fornecedor_tenant_id, b.mes)
  )
)
SELECT
  n.distribuidor_id,
  n.fornecedor_tenant_id,
  n.vendedor_id,
  (n.g = 1) AS eh_total_distribuidor,
  n.mes,
  n.faturamento,
  n.nfs,
  n.clientes_positivados,
  coalesce(s.skus_distintos, 0) AS skus_distintos
FROM notas n
-- IS NOT DISTINCT FROM porque vendedor_id e fornecedor_tenant_id são NULL-áveis
-- e `=` com NULL não casa.
LEFT JOIN skus s
  ON  s.distribuidor_id      IS NOT DISTINCT FROM n.distribuidor_id
  AND s.fornecedor_tenant_id IS NOT DISTINCT FROM n.fornecedor_tenant_id
  AND s.mes                  =  n.mes
  AND s.g                    =  n.g
  AND s.vendedor_id          IS NOT DISTINCT FROM n.vendedor_id;

COMMENT ON VIEW alwayson_faturamento_v_mensal IS
  'Série mensal de sell-in por distribuidor/fornecedor, com linha de total (eh_total_distribuidor) e linha por vendedor. Positivados e SKUs não são aditivos: use a linha de total, nunca a soma.';
```

- [ ] **Step 2: Aplicar a migration**

```bash
npm run db:migrate
```

Se `DATABASE_URL` não estiver no `.env.local`, aplique pelo SQL Editor do dashboard (ref `osukbalwykbqvoumddxz`) ou pelo MCP Supabase (`apply_migration`).

- [ ] **Step 3: Verificar que o total bate com a tela e que a não-aditividade se mantém**

Rode:

```sql
select
  (select faturamento::numeric(14,2) from alwayson_faturamento_v_mensal
    where eh_total_distribuidor and mes = '2026-06-01')            as fat_total,
  (select clientes_positivados from alwayson_faturamento_v_mensal
    where eh_total_distribuidor and mes = '2026-06-01')            as positivados,
  (select skus_distintos from alwayson_faturamento_v_mensal
    where eh_total_distribuidor and mes = '2026-06-01')            as skus,
  (select sum(skus_distintos) from alwayson_faturamento_v_mensal
    where not eh_total_distribuidor and mes = '2026-06-01')        as skus_se_somados,
  (select count(*) from alwayson_faturamento_v_mensal)             as linhas;
```

Esperado, exatamente:

| fat_total | positivados | skus | skus_se_somados | linhas |
|---|---|---|---|---|
| 658635.24 | 522 | 35 | 562 | 1067 |

`fat_total`, `positivados` e `skus` são os três cards do print de junho. Se `fat_total` vier maior, o join de itens vazou para o cálculo de faturamento — reveja os CTEs.

- [ ] **Step 4: Verificar que a view não é `SECURITY DEFINER`**

```sql
select c.relname, c.reloptions
from pg_class c
where c.relname = 'alwayson_faturamento_v_mensal';
```

Esperado: `reloptions` contém `security_invoker=true`. Se vier NULL, a view fura o escopo por tenant — refaça com a cláusula `WITH`.

- [ ] **Step 5: Commit**

```bash
git add docs/migrations/067_faturamento_mensal_agregado.sql
git commit -m "feat(performance): view mensal agregada de faturamento

Série de 20 meses em 1.067 linhas, contra 24.389 itens carregados nota a nota.
GROUPING SETS porque positivados e SKUs não somam: em junho o distribuidor tem
35 SKUs distintos e a soma das linhas de vendedor daria 562.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Paralelizar o fetch de SKUs

Ao trocar mês por janela, as tabelas passam a pedir 12 meses de linhas cruas. Hoje `fetchSkusByFaturamento` fatia os IDs de 200 em 200 e percorre as fatias **em série**: ~500 NFs num mês são 3 idas ao Postgres; 7.314 NFs em 12 meses são ~37 idas encadeadas.

**Files:**
- Modify: `src/lib/loadFaturamentoSales.ts:47-74`

**Interfaces:**
- Consumes: nada de tasks anteriores.
- Produces: `loadFaturamentoSales` mantém exatamente a mesma assinatura e o mesmo retorno. Só o tempo muda.

- [ ] **Step 1: Medir a linha de base**

Com `npm run dev`, abra `/performance`, aba Network, filtre por `alwayson_faturamento_itens`. Recarregue e conte as requisições.

Esperado hoje, com um mês selecionado: ~3, disparadas **em cascata** (cada uma começa quando a anterior termina — visível na coluna de waterfall). É a cascata que se quer eliminar; o número de requisições continua o mesmo depois da mudança.

- [ ] **Step 2: Trocar o laço sequencial por fatias em paralelo**

Substitua o corpo de `fetchSkusByFaturamento` por:

```ts
async function fetchSkusByFaturamento(
  faturamentoIds: string[]
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>()
  if (!faturamentoIds.length) return map

  const slices: string[][] = []
  for (let i = 0; i < faturamentoIds.length; i += 200) {
    slices.push(faturamentoIds.slice(i, i + 200))
  }

  // Uma fatia por vez era ~37 idas encadeadas numa janela de 12 meses. Em
  // paralelo, com teto para não abrir dezenas de conexões de uma vez.
  const CONCORRENCIA = 6
  for (let i = 0; i < slices.length; i += CONCORRENCIA) {
    const lote = slices.slice(i, i + CONCORRENCIA)
    const resultados = await Promise.all(lote.map((slice) => fetchSkusSlice(slice)))
    for (const linhas of resultados) {
      for (const row of linhas) {
        const list = map.get(row.faturamento_id)
        if (list) list.push(row.sku)
        else map.set(row.faturamento_id, [row.sku])
      }
    }
  }
  return map
}

/** Uma fatia de IDs, paginada — a paginação continua sequencial dentro da fatia. */
async function fetchSkusSlice(
  slice: string[]
): Promise<{ faturamento_id: string; sku: string }[]> {
  const out: { faturamento_id: string; sku: string }[] = []
  let from = 0
  for (;;) {
    const { data, error } = await supabase
      .from('alwayson_faturamento_itens')
      .select('faturamento_id, sku')
      .in('faturamento_id', slice)
      .range(from, from + PAGE - 1)
    if (error) throw error
    const chunk = data ?? []
    out.push(...chunk)
    if (chunk.length < PAGE) break
    from += PAGE
  }
  return out
}
```

- [ ] **Step 3: Verificar tipos**

```bash
npx tsc -b --noEmit
```

Esperado: sem saída (exit 0).

- [ ] **Step 4: Verificar que o resultado não mudou**

Com `npm run dev`, abra `/performance` num mês qualquer e confira que os KPIs `FATURAMENTO TOTAL`, `CLIENTES POSITIVADOS` e `ITENS VENDIDOS` continuam iguais aos de antes da mudança. Para junho/2026 e o distribuidor Paraty: R$ 658.635, 522 e 35.

Esta é a verificação que importa — a mudança é de desempenho, e o risco é alterar o resultado sem perceber.

- [ ] **Step 5: Commit**

```bash
git add src/lib/loadFaturamentoSales.ts
git commit -m "perf(faturamento): buscar SKUs em fatias paralelas

Em série eram ~37 idas encadeadas ao Postgres numa janela de 12 meses (7.314
NFs). Com teto de 6 fatias simultâneas, para não abrir dezenas de conexões.
Resultado idêntico — só o tempo muda.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Cálculo de janela e comparação

Módulo puro, sem React e sem rede — é a peça que decide quais meses entram na janela e contra quais eles são comparados. Isolado por dois motivos: é a única lógica com regra de negócio real nesta etapa, e é o que fica testável sozinho no dia em que o repo tiver framework de teste.

**Files:**
- Create: `src/lib/janela-periodo.ts`

**Interfaces:**
- Produces:
  - `type JanelaMeses = 6 | 12 | 24 | 0` (0 = série inteira)
  - `type ComparacaoModo = 'ano_anterior' | 'periodo_anterior' | 'nenhum'`
  - `interface Janela { inicio: string; fim: string; meses: string[] }` — `inicio`/`fim` em `YYYY-MM`, `meses` a lista completa em ordem.
  - `calcularJanela(janela: JanelaMeses, hoje?: Date): Janela`
  - `calcularComparacao(base: Janela, modo: ComparacaoModo): Janela | null`
  - `mesEmCurso(hoje?: Date): string`

- [ ] **Step 1: Escrever o módulo**

```ts
/**
 * Janela temporal da Performance e o período contra o qual ela é comparada.
 *
 * A janela termina no último mês **completo**, nunca no mês em curso: em 11/08
 * agosto tem 48 NFs contra ~600 de um mês fechado, e incluí-lo faria a leitura
 * parecer um colapso. O mês em curso aparece no gráfico, marcado — ver
 * `mesEmCurso`.
 */

export type JanelaMeses = 6 | 12 | 24 | 0
export type ComparacaoModo = 'ano_anterior' | 'periodo_anterior' | 'nenhum'

export interface Janela {
  /** YYYY-MM */
  inicio: string
  /** YYYY-MM */
  fim: string
  /** Todos os meses da janela, em ordem crescente. */
  meses: string[]
}

/** Primeiro mês com dado no banco. Antes disto não há o que comparar. */
export const PRIMEIRO_MES_SERIE = '2025-01'

function toKey(ano: number, mesIndex0: number): string {
  const d = new Date(Date.UTC(ano, mesIndex0, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

function parseKey(key: string): { ano: number; mes0: number } {
  const [a, m] = key.split('-').map(Number)
  return { ano: a, mes0: m - 1 }
}

function somarMeses(key: string, delta: number): string {
  const { ano, mes0 } = parseKey(key)
  return toKey(ano, mes0 + delta)
}

function intervalo(inicio: string, fim: string): string[] {
  const out: string[] = []
  let cursor = inicio
  while (cursor <= fim) {
    out.push(cursor)
    cursor = somarMeses(cursor, 1)
  }
  return out
}

/** Mês corrente, que está incompleto por definição. */
export function mesEmCurso(hoje: Date = new Date()): string {
  return toKey(hoje.getFullYear(), hoje.getMonth())
}

export function calcularJanela(janela: JanelaMeses, hoje: Date = new Date()): Janela {
  const fim = somarMeses(mesEmCurso(hoje), -1)
  const inicio =
    janela === 0 ? PRIMEIRO_MES_SERIE : somarMeses(fim, -(janela - 1))
  const inicioLimitado = inicio < PRIMEIRO_MES_SERIE ? PRIMEIRO_MES_SERIE : inicio
  return { inicio: inicioLimitado, fim, meses: intervalo(inicioLimitado, fim) }
}

/**
 * Devolve null quando não há contraparte — para jan/2025 não existe 2024 no
 * banco, e a tela mostra a variação vazia em vez de inventar um número.
 */
export function calcularComparacao(base: Janela, modo: ComparacaoModo): Janela | null {
  if (modo === 'nenhum') return null

  const deslocamento =
    modo === 'ano_anterior' ? -12 : -base.meses.length

  const inicio = somarMeses(base.inicio, deslocamento)
  const fim = somarMeses(base.fim, deslocamento)
  if (fim < PRIMEIRO_MES_SERIE) return null

  const inicioLimitado = inicio < PRIMEIRO_MES_SERIE ? PRIMEIRO_MES_SERIE : inicio
  return { inicio: inicioLimitado, fim, meses: intervalo(inicioLimitado, fim) }
}
```

- [ ] **Step 2: Verificar tipos**

```bash
npx tsc -b --noEmit
```

Esperado: sem saída.

- [ ] **Step 3: Conferir o comportamento nas bordas**

Rode um script pontual (apague depois; não vira arquivo do repo):

```bash
npx tsx -e "
import { calcularJanela, calcularComparacao } from './src/lib/janela-periodo'
const hoje = new Date('2026-08-11T12:00:00Z')
const j = calcularJanela(12, hoje)
console.log('janela  ', j.inicio, '->', j.fim, '|', j.meses.length, 'meses')
console.log('ano ant ', JSON.stringify(calcularComparacao(j, 'ano_anterior')?.inicio))
const inteira = calcularJanela(0, hoje)
console.log('inteira ', inteira.inicio, '->', inteira.fim, '|', inteira.meses.length)
console.log('sem par ', calcularComparacao({inicio:'2025-01',fim:'2025-01',meses:['2025-01']}, 'ano_anterior'))
"
```

Esperado, exatamente:

```
janela   2025-08 -> 2026-07 | 12 meses
ano ant  "2025-01"
inteira  2025-01 -> 2026-07 | 19
sem par  null
```

A janela **termina em 2026-07**, não em 2026-08 — é o comportamento correto: agosto está em curso. E a comparação de jan/2025 devolve `null`, não zero.

Se `npx tsx` não estiver disponível, troque por um `console.log` temporário dentro de um componente e leia no browser.

- [ ] **Step 4: Commit**

```bash
git add src/lib/janela-periodo.ts
git commit -m "feat(performance): cálculo de janela temporal e período de comparação

A janela fecha no último mês completo — incluir o mês em curso faria agosto
(48 NFs no dia 11) parecer colapso. Comparação sem contraparte devolve null,
para a tela mostrar vazio em vez de inventar variação.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Tipo e hook da série mensal

**Files:**
- Create: `src/types/faturamento-mensal.ts`
- Create: `src/hooks/useFaturamentoMensal.ts`

**Interfaces:**
- Consumes: view `alwayson_faturamento_v_mensal` (Task 1); `Janela` de `src/lib/janela-periodo` (Task 3).
- Produces:
  - `interface FaturamentoMensalRow` — espelha as colunas da view.
  - `interface ResumoPeriodo { faturamento: number; nfs: number; clientes: number; ticketMedio: number }`
  - `useFaturamentoMensal(distribuidorId: string | undefined, janela: Janela)` → `{ data, isLoading }` com `data: FaturamentoMensalRow[]`
  - `resumirPeriodo(rows: FaturamentoMensalRow[]): ResumoPeriodo`

- [ ] **Step 1: Escrever o tipo**

`src/types/faturamento-mensal.ts`:

```ts
/** Uma linha de `alwayson_faturamento_v_mensal` (migration 067). */
export interface FaturamentoMensalRow {
  distribuidor_id: string
  fornecedor_tenant_id: string | null
  /** NULL na linha de total do distribuidor. */
  vendedor_id: string | null
  /** true = linha de total; false = linha de um vendedor. */
  eh_total_distribuidor: boolean
  /** Primeiro dia do mês, YYYY-MM-DD. */
  mes: string
  faturamento: number
  nfs: number
  clientes_positivados: number
  skus_distintos: number
}
```

- [ ] **Step 2: Escrever o hook**

`src/hooks/useFaturamentoMensal.ts`:

```ts
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Janela } from '@/lib/janela-periodo'
import type { FaturamentoMensalRow } from '@/types/faturamento-mensal'

export interface ResumoPeriodo {
  faturamento: number
  nfs: number
  clientes: number
  ticketMedio: number
}

/**
 * Série mensal do período. Lê só as linhas de total do distribuidor — as linhas
 * por vendedor existem na view para a etapa 2 (minisséries por linha).
 */
export function useFaturamentoMensal(
  distribuidorId: string | undefined,
  janela: Janela
) {
  return useQuery({
    queryKey: ['faturamento-mensal', distribuidorId ?? 'all', janela.inicio, janela.fim],
    queryFn: async (): Promise<FaturamentoMensalRow[]> => {
      let q = supabase
        .from('alwayson_faturamento_v_mensal')
        .select(
          'distribuidor_id, fornecedor_tenant_id, vendedor_id, eh_total_distribuidor, mes, faturamento, nfs, clientes_positivados, skus_distintos'
        )
        .eq('eh_total_distribuidor', true)
        .gte('mes', `${janela.inicio}-01`)
        .lte('mes', `${janela.fim}-01`)
        .order('mes', { ascending: true })

      if (distribuidorId) q = q.eq('distribuidor_id', distribuidorId)

      const { data, error } = await q
      if (error) throw error
      return (data ?? []).map((r) => ({
        ...r,
        faturamento: Number(r.faturamento),
        nfs: Number(r.nfs),
        clientes_positivados: Number(r.clientes_positivados),
        skus_distintos: Number(r.skus_distintos),
      })) as FaturamentoMensalRow[]
    },
  })
}

/**
 * Agrega a janela. Faturamento e NFs somam; `clientes` NÃO — a view entrega
 * distintos por mês, e o mesmo cliente aparece em vários. O valor aqui é
 * "clientes atendidos por mês, em média", e o rótulo na UI tem de dizer isso.
 */
export function resumirPeriodo(rows: FaturamentoMensalRow[]): ResumoPeriodo {
  const faturamento = rows.reduce((s, r) => s + r.faturamento, 0)
  const nfs = rows.reduce((s, r) => s + r.nfs, 0)
  const clientes = rows.length
    ? Math.round(rows.reduce((s, r) => s + r.clientes_positivados, 0) / rows.length)
    : 0
  return {
    faturamento,
    nfs,
    clientes,
    ticketMedio: nfs > 0 ? faturamento / nfs : 0,
  }
}
```

⚠️ **Leia o comentário de `resumirPeriodo` antes de seguir.** Somar `clientes_positivados` entre meses conta o mesmo cliente várias vezes. A média mensal é honesta e é o que a UI vai rotular; o número de clientes **únicos na janela** exigiria uma consulta própria e fica para a etapa 2, se fizer falta.

- [ ] **Step 3: Verificar tipos**

```bash
npx tsc -b --noEmit
```

Esperado: sem saída.

- [ ] **Step 4: Verificar contra o banco**

Confirme que o hook devolveria os mesmos números que o SQL direto:

```sql
select mes, faturamento::numeric(14,2), nfs, clientes_positivados
from alwayson_faturamento_v_mensal
where eh_total_distribuidor
  and mes between '2025-08-01' and '2026-07-01'
order by mes;
```

Esperado: 12 linhas. `2026-06-01` com 658635.24 / 626 / 522. `2026-07-01` com 665379.85 / 635 / 551.

- [ ] **Step 5: Commit**

```bash
git add src/types/faturamento-mensal.ts src/hooks/useFaturamentoMensal.ts
git commit -m "feat(performance): hook da série mensal a partir da view agregada

Lê só as linhas de total; as de vendedor ficam para as minisséries da etapa 2.
resumirPeriodo soma faturamento e NFs, mas tira média de positivados — somá-los
entre meses contaria o mesmo cliente repetidas vezes.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Filtros JANELA e COMPARAR COM

**Files:**
- Modify: `src/pages/performance/usePerfFilters.ts`
- Modify: `src/pages/Performance.tsx:124-133`

**Interfaces:**
- Consumes: `JanelaMeses`, `ComparacaoModo`, `calcularJanela`, `calcularComparacao` (Task 3).
- Produces: `PerfFilters` ganha `janela: JanelaMeses` e `comparar: ComparacaoModo`. `periodoInicio`/`periodoFim` passam a ser **derivados da janela** e continuam existindo com o mesmo formato `YYYY-MM`, para as tabelas hierárquicas não mudarem.

- [ ] **Step 1: Estender `PerfFilters`**

Em `src/pages/performance/usePerfFilters.ts`, substitua o bloco `periodoMes` da interface por:

```ts
  /** Tamanho da janela em meses; 0 = série inteira. */
  janela: JanelaMeses
  /** Contra o que comparar a janela. */
  comparar: ComparacaoModo
  /** Início da janela (YYYY-MM) — derivado, consumido pelas tabelas. */
  periodoInicio?: string
  /** Fim da janela (YYYY-MM) — derivado, consumido pelas tabelas. */
  periodoFim?: string
```

Remova `periodoMes` da interface e do `PARAM_MAP`, e acrescente ao mapa:

```ts
  janela: 'janela',
  comparar: 'comparar',
```

- [ ] **Step 2: Derivar o período a partir da janela**

Substitua `readPeriodoMes` e `applyPeriodoMes` por:

```ts
function readJanela(searchParams: URLSearchParams): JanelaMeses {
  const raw = Number(searchParams.get('janela'))
  return raw === 6 || raw === 24 || raw === 0 ? raw : 12
}

function readComparar(searchParams: URLSearchParams): ComparacaoModo {
  const raw = searchParams.get('comparar')
  return raw === 'periodo_anterior' || raw === 'nenhum' ? raw : 'ano_anterior'
}
```

E, dentro de `usePerfFilters`, monte os filtros assim:

```ts
  const janela = readJanela(searchParams)
  const comparar = readComparar(searchParams)
  const periodo = calcularJanela(janela)

  const filters: PerfFilters = {
    tab: (searchParams.get('tab') as PerfTab) || 'distribuidor',
    distribuidorId: searchParams.get('distribuidor') || undefined,
    gerenteId: searchParams.get('gerente') || undefined,
    supervisorId: searchParams.get('supervisor') || undefined,
    vendedorId: searchParams.get('vendedor') || undefined,
    janela,
    comparar,
    periodoInicio: periodo.inicio,
    periodoFim: periodo.fim,
    metrica: searchParams.get('metrica') === 'unidade' ? 'unidade' : 'faturamento',
  }
```

No `setFilter` e no `drillDown`, remova os ramos especiais de `periodoMes`/`periodoInicio`/`periodoFim` — eles deixam de ser graváveis, porque agora derivam de `janela`.

Adicione o import no topo:

```ts
import {
  calcularJanela,
  type ComparacaoModo,
  type JanelaMeses,
} from '@/lib/janela-periodo'
```

⚠️ **Links antigos.** URLs salvas com `?periodo=2026-06` deixam de selecionar junho — passam a cair na janela padrão de 12 meses. É consequência aceita da mudança de eixo, não um bug a corrigir: o conceito "um mês" deixou de existir nesta tela.

✅ **As tabelas não precisam de mudança nenhuma.** `aggregateSales` calcula os distintos com `Set` sobre as linhas cruas (`src/lib/faturamentoAgg.ts:21`), então alargar o intervalo **já recalcula** positivados e SKUs corretamente — não existe o risco de somar valores mensais. O spec pedia que esta etapa decidisse o comportamento; a decisão é que o comportamento correto já é o atual. Confirme no Step 5 que os números fazem sentido, mas não altere `faturamentoAgg.ts`.

- [ ] **Step 3: Trocar o campo de filtro na tela**

Em `src/pages/Performance.tsx`, substitua o `FilterField` de `Mês` (linhas 124-133) por:

```tsx
        <FilterField label="Janela">
          <Select
            value={String(filters.janela)}
            onValueChange={(v) => setFilter('janela', v)}
          >
            <SelectTrigger className="h-8 w-full text-sm">
              <SelectValue>{JANELA_LABELS[filters.janela]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="6">6 meses</SelectItem>
              <SelectItem value="12">12 meses</SelectItem>
              <SelectItem value="24">24 meses</SelectItem>
              <SelectItem value="0">Toda a série</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label="Comparar com">
          <Select
            value={filters.comparar}
            onValueChange={(v) => setFilter('comparar', v)}
          >
            <SelectTrigger className="h-8 w-full text-sm">
              <SelectValue>{COMPARAR_LABELS[filters.comparar]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ano_anterior">Ano anterior</SelectItem>
              <SelectItem value="periodo_anterior">Período anterior</SelectItem>
              <SelectItem value="nenhum">Nada</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>
```

Acrescente perto do topo do arquivo, junto de `TAB_COMPONENTS`:

```tsx
const JANELA_LABELS: Record<number, string> = {
  6: '6 meses',
  12: '12 meses',
  24: '24 meses',
  0: 'Toda a série',
}

const COMPARAR_LABELS: Record<string, string> = {
  ano_anterior: 'Ano anterior',
  periodo_anterior: 'Período anterior',
  nenhum: 'Nada',
}
```

E ajuste o `gridClassName` do `FilterBar` para acomodar o campo a mais:

```tsx
      <FilterBar gridClassName="grid-cols-1 sm:grid-cols-[minmax(0,1fr)_9rem_10rem_auto]">
```

Os dois `SelectValue` recebem rótulo explícito de propósito — sem ele o Radix cai no fallback do value bruto, que é a regra do `CLAUDE.md`.

- [ ] **Step 4: Verificar tipos**

```bash
npx tsc -b --noEmit
```

Esperado: sem saída. Se acusar `periodoMes` em algum tab, é um consumidor que ficou para trás — troque por `periodoInicio`/`periodoFim`.

- [ ] **Step 5: Verificar no browser**

Com `npm run dev`, abra `/performance`:

- Os filtros mostram `Janela: 12 meses` e `Comparar com: Ano anterior`.
- A URL ganha `?janela=12&comparar=ano_anterior` ao trocar qualquer um.
- Nenhum UUID aparece em nenhum select.
- A tabela de distribuidores mostra faturamento **muito maior** que antes — é a janela inteira, não um mês. Para a Paraty, algo próximo de R$ 8,1M em 12 meses (ago/2025 a jul/2026), contra os R$ 658 mil de junho isolado. Isso é o esperado, não um erro.

- [ ] **Step 6: Commit**

```bash
git add src/pages/performance/usePerfFilters.ts src/pages/Performance.tsx
git commit -m "feat(performance): filtro de janela temporal no lugar do mês

periodoInicio/Fim passam a derivar da janela, então as tabelas hierárquicas
seguem funcionando sem alteração — só recebem intervalo em vez de um mês.
Links antigos com ?periodo= caem na janela padrão: o conceito de mês único
deixou de existir nesta tela.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Faixa de topo com variação

**Files:**
- Create: `src/pages/performance/EvolucaoResumo.tsx`
- Modify: `src/pages/performance/DistribuidorTab.tsx`

**Interfaces:**
- Consumes: `useFaturamentoMensal`, `resumirPeriodo`, `ResumoPeriodo` (Task 4); `calcularJanela`, `calcularComparacao` (Task 3); filtros `janela`/`comparar` (Task 5).
- Produces: `<EvolucaoResumo />` — sem props; lê tudo do `usePerformanceContext`.

- [ ] **Step 1: Escrever o componente**

`src/pages/performance/EvolucaoResumo.tsx`:

```tsx
import { DollarSign, FileText, Users, Receipt } from 'lucide-react'
import { KPICard } from '@/components/distribuidor/KPICard'
import { KPIGrid } from '@/components/distribuidor/KPIGrid'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/format'
import { calcularComparacao, calcularJanela } from '@/lib/janela-periodo'
import { resumirPeriodo, useFaturamentoMensal } from '@/hooks/useFaturamentoMensal'
import { usePerformanceContext } from './PerformanceContext'

/**
 * Percentual de variação, ou null quando não há contraparte. Devolve número
 * cru porque o KPICard já formata sinal, casas e cor pela prop `trend`.
 */
function variacao(atual: number, anterior: number | undefined): number | null {
  if (anterior === undefined || anterior === 0) return null
  return ((atual - anterior) / anterior) * 100
}

/** Monta as props de variação do KPICard a partir do par (atual, anterior). */
function propsVariacao(atual: number, anterior: number | undefined, legenda: string) {
  const v = variacao(atual, anterior)
  if (v === null) return { subtitle: 'sem comparação' }
  return { trend: { value: v, positive: v >= 0 }, subtitle: legenda }
}

const LEGENDA_COMPARACAO: Record<string, string> = {
  ano_anterior: 'vs. ano anterior',
  periodo_anterior: 'vs. período anterior',
  nenhum: '',
}

export function EvolucaoResumo() {
  const { filters } = usePerformanceContext()
  const janela = calcularJanela(filters.janela)
  const comparacao = calcularComparacao(janela, filters.comparar)

  const { data: atual = [], isLoading } = useFaturamentoMensal(
    filters.distribuidorId,
    janela
  )
  const { data: anterior = [] } = useFaturamentoMensal(
    filters.distribuidorId,
    comparacao ?? janela
  )

  if (isLoading) {
    return (
      <KPIGrid>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </KPIGrid>
    )
  }

  const a = resumirPeriodo(atual)
  // Sem contraparte não há com o que comparar — a variação fica ausente, não zero.
  const b = comparacao ? resumirPeriodo(anterior) : undefined
  const legenda = LEGENDA_COMPARACAO[filters.comparar]

  return (
    <KPIGrid>
      <KPICard
        label="Faturamento"
        value={formatCurrency(a.faturamento)}
        icon={DollarSign}
        {...propsVariacao(a.faturamento, b?.faturamento, legenda)}
      />
      <KPICard
        label="Notas"
        value={a.nfs.toLocaleString('pt-BR')}
        icon={FileText}
        {...propsVariacao(a.nfs, b?.nfs, legenda)}
      />
      <KPICard
        label="Clientes por mês"
        value={a.clientes.toLocaleString('pt-BR')}
        icon={Users}
        {...propsVariacao(a.clientes, b?.clientes, legenda)}
      />
      <KPICard
        label="Ticket médio"
        value={formatCurrency(a.ticketMedio)}
        icon={Receipt}
        {...propsVariacao(a.ticketMedio, b?.ticketMedio, legenda)}
      />
    </KPIGrid>
  )
}
```

O rótulo do terceiro card é **"Clientes por mês"**, não "Clientes": o valor é a média mensal de positivados, porque somá-los entre meses contaria o mesmo cliente repetidas vezes. Rotulá-lo como total seria mentira.

O `KPICard` já existe com as props certas (`label`, `value`, `icon`, `trend`, `subtitle`) — **não o altere**. A prop `trend` recebe `{ value: number; positive: boolean }` e cuida sozinha do sinal, da casa decimal e da cor (verde/vermelho). É por isso que `variacao()` devolve número cru em vez de string formatada.

- [ ] **Step 2: Montar na aba**

Em `src/pages/performance/DistribuidorTab.tsx`, importe e insira `<EvolucaoResumo />` no lugar do `KPIGrid` atual, mantendo a tabela abaixo intocada. O `MetaProgressBar` sai desta aba — a meta volta na etapa 2 como marcador sobre a série, e como card ela pertence ao Dashboard.

- [ ] **Step 3: Verificar tipos**

```bash
npx tsc -b --noEmit
```

- [ ] **Step 4: Verificar os números no browser**

Com `npm run dev`, em `/performance`, distribuidor **Todos**, janela **12 meses**, comparar **Ano anterior**: a faixa deve mostrar quatro cards com variação percentual em cada um.

A verificação forte é trocar a janela para **6 meses** e conferir contra o SQL:

```sql
select sum(faturamento)::numeric(14,2) as fat, sum(nfs) as nfs
from alwayson_faturamento_v_mensal
where eh_total_distribuidor and mes between '2026-02-01' and '2026-07-01';
```

O card `Faturamento` tem de bater com `fat` exatamente.

- [ ] **Step 5: Commit**

```bash
git add src/pages/performance/EvolucaoResumo.tsx src/pages/performance/DistribuidorTab.tsx
git commit -m "feat(performance): faixa de topo com variação contra o período anterior

Quatro leituras do período em vez de valores de um mês. O card de clientes é
média mensal e diz isso no rótulo — somar positivados entre meses contaria o
mesmo cliente várias vezes. Sem contraparte, a variação fica ausente.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Gráfico de série com o ano anterior sobreposto

**Files:**
- Create: `src/pages/performance/EvolucaoGrafico.tsx`
- Modify: `src/pages/performance/DistribuidorTab.tsx`

**Interfaces:**
- Consumes: `useFaturamentoMensal` (Task 4), `calcularJanela`/`calcularComparacao`/`mesEmCurso` (Task 3).
- Produces: `<EvolucaoGrafico />` — sem props.

- [ ] **Step 1: Carregar a skill de dataviz**

**Antes de escrever qualquer código de gráfico**, invoque a skill `dataviz`. Ela define paleta, eixos, legenda e comportamento em tema claro/escuro, e este gráfico tem de ficar coerente com os do Insights.

- [ ] **Step 2: Escrever o componente**

Estrutura obrigatória — as decisões de cor e formatação de eixo vêm da skill do passo anterior:

```tsx
import { useMemo } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card } from '@/components/ui/card'
import { formatCurrency } from '@/lib/format'
import { calcularComparacao, calcularJanela } from '@/lib/janela-periodo'
import { useFaturamentoMensal } from '@/hooks/useFaturamentoMensal'
import { usePerformanceContext } from './PerformanceContext'

const MES_CURTO = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez',
]

function rotuloMes(mesIso: string): string {
  const [ano, mes] = mesIso.split('-').map(Number)
  return `${MES_CURTO[mes - 1]}/${String(ano).slice(2)}`
}

export function EvolucaoGrafico() {
  const { filters } = usePerformanceContext()
  const janela = calcularJanela(filters.janela)
  const comparacao = calcularComparacao(janela, filters.comparar)

  const { data: atual = [] } = useFaturamentoMensal(filters.distribuidorId, janela)
  const { data: anterior = [] } = useFaturamentoMensal(
    filters.distribuidorId,
    comparacao ?? janela
  )

  const dados = useMemo(() => {
    // Alinha por posição: o i-ésimo mês da janela contra o i-ésimo da
    // comparação. Alinhar por data não funciona — são períodos diferentes.
    //
    // O mês em curso não entra: `calcularJanela` fecha no último mês completo.
    // É por isso que o gráfico não precisa de marcação de "parcial" — não há
    // ponto parcial nele.
    return janela.meses.map((mes, i) => {
      const linhaAtual = atual.find((r) => r.mes.startsWith(mes))
      const linhaAnterior = comparacao
        ? anterior.find((r) => r.mes.startsWith(comparacao.meses[i] ?? ''))
        : undefined
      return {
        mes: rotuloMes(mes),
        atual: linhaAtual?.faturamento ?? 0,
        anterior: linhaAnterior?.faturamento ?? null,
      }
    })
  }, [janela, comparacao, atual, anterior])

  return (
    <Card className="mb-4 p-4">
      <h3 className="mb-3 text-sm font-semibold">Faturamento mês a mês</h3>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={dados}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="mes" tickLine={false} axisLine={false} fontSize={11} />
          <YAxis
            tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
            tickLine={false}
            axisLine={false}
            fontSize={11}
          />
          <Tooltip formatter={(v: number) => formatCurrency(v)} />
          <Legend />
          <Line
            type="monotone"
            dataKey="anterior"
            name="Período anterior"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={false}
            connectNulls={false}
          />
          <Line
            type="monotone"
            dataKey="atual"
            name="Período atual"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  )
}
```

`connectNulls={false}` é deliberado: onde não há contraparte a linha tem de **interromper**, não atravessar o vazio fingindo continuidade.

- [ ] **Step 3: Montar na aba**

Insira `<EvolucaoGrafico />` em `DistribuidorTab.tsx`, entre `<EvolucaoResumo />` e a tabela.

- [ ] **Step 4: Verificar tipos**

```bash
npx tsc -b --noEmit
```

- [ ] **Step 5: Verificar a leitura de sazonalidade no browser**

Com janela **24 meses** e comparação **Ano anterior**, em `/performance`:

- A linha cheia mostra pico em **mar/26** (R$ 2,1M) e vale em **set/25** (R$ 299k).
- A linha tracejada acompanha o mesmo desenho um ano antes — pico em mar/25 (R$ 1,78M).
- Nos meses sem contraparte (jan/25 a jul/25 quando a janela chega lá), a linha tracejada **não aparece**, em vez de rastejar no zero.

Este é o critério que justifica a tela: abril cair contra março tem de ficar visivelmente igual nos dois anos.

- [ ] **Step 6: Verificar tema escuro e responsivo**

Use `resize_window` do Browser pane em `mobile` e alterne `colorScheme` para `dark`. O gráfico não pode estourar a largura da página, e as duas linhas têm de continuar distinguíveis no escuro.

- [ ] **Step 7: Commit**

```bash
git add src/pages/performance/EvolucaoGrafico.tsx src/pages/performance/DistribuidorTab.tsx
git commit -m "feat(performance): série mensal com o período anterior sobreposto

É o que torna a sazonalidade legível em vez de alarmante: a queda de abril
contra março aparece nos dois anos, e a distância entre as linhas é o
crescimento real. Sem contraparte a linha interrompe, não atravessa o zero.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Verificação final da etapa

Depois da Task 7, confira os critérios de sucesso do spec que a etapa 1 promete entregar:

- [ ] **Critério 1** — janela 12 meses, comparar Ano anterior: os cards mostram faturamento bem acima de clientes por mês e de ticket, deixando concluir que o crescimento veio de frequência.
- [ ] **Critério 3** — abril e setembro não parecem colapso: a linha tracejada mostra o mesmo vale.
- [ ] **Critério 5** — o total de positivados do distribuidor não é a soma dos vendedores. Confirme pelo SQL da Task 1, Step 3.
- [ ] **Regressão** — o drill-down por URL continua funcionando: clique de Distribuidor até Cliente e confira que os parâmetros da URL acompanham e que voltar pelo breadcrumb funciona.
- [ ] **Regressão** — nenhum UUID visível em nenhum filtro ou tabela.

## Fora desta etapa

Vão para a etapa 2, conforme o spec:

- As três colunas (valor, variação YoY, minissérie) nos cinco níveis de tabela.
- Meta como marcador sobre a série.
- Clientes únicos na janela (hoje a faixa mostra média mensal).
