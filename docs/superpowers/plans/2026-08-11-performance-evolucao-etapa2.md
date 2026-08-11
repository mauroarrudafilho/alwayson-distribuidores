# Performance — Evolução, Etapa 2 (o detalhe por linha)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar às cinco tabelas hierárquicas da Performance uma coluna de variação contra o período de comparação e uma minissérie de faturamento por linha, para responder "quem puxou o crescimento" e "quem está a cair contra o próprio ano passado".

**Architecture:** Duas views novas cobrem os níveis que a etapa 1 não alcança — uma com a hierarquia rolada por CTE recursivo, outra no grão de cliente. Ambas entregam **apenas faturamento e NFs**, métricas aditivas, porque rolar distintos pela hierarquia contaria o mesmo cliente uma vez por vendedor. A minissérie é SVG inline, não Recharts.

**Tech Stack:** React 19 + Vite, TanStack Query, Supabase (`osukbalwykbqvoumddxz`), Tailwind + shadcn/ui.

## Global Constraints

- **Sem framework de teste neste repo.** Não existe vitest/jest nem nenhum `*.test.*`. Não crie um. A verificação é SQL contra o banco (MCP Supabase ou SQL Editor), `npx tsc -b --noEmit`, e leitura de código. Verificação visual no browser **não é possível** para os agentes — a tela exige sessão autenticada; ela fica para o utilizador.
- **Projeto Supabase:** ref `osukbalwykbqvoumddxz`. Nunca `kgzybpelluftexrewyke`.
- **Views novas nascem com `WITH (security_invoker = true)`** e carregam **os dois eixos** (`distribuidor_id` + `fornecedor_tenant_id`).
- **A minissérie e a variação mostram só `faturamento`.** Positivados e itens continuam foto do período. Isto é decisão de spec, não omissão — ver `docs/superpowers/specs/2026-08-11-performance-evolucao-design.md`, secção "Alcance da etapa 2".
- **Nunca expor UUID na UI.**
- **Não usar Recharts na minissérie.** Uma tabela de clientes pode ter milhares de linhas; um `ResponsiveContainer` por linha instala um `ResizeObserver` por linha. A minissérie é SVG inline, sem dependências.
- **Commits em português**, padrão do repo, terminando com `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `docs/migrations/068_faturamento_mensal_hierarquia_cliente.sql` (criar) | As duas views |
| `src/hooks/useSerieEntidade.ts` (criar) | Séries por entidade, para as duas views |
| `src/pages/performance/Minisserie.tsx` (criar) | Sparkline SVG inline, sem dependências |
| `src/pages/performance/ColunaEvolucao.tsx` (criar) | Célula com variação + minissérie, partilhada pelas cinco tabelas |
| `src/pages/performance/sortableNumeric.tsx` (modificar) | `variacao` como campo ordenável, com política de nulos |
| `src/pages/performance/DistribuidorTab.tsx` (modificar) | Coluna nova |
| `src/pages/performance/GerenciaTab.tsx` (modificar) | Coluna nova |
| `src/pages/performance/SupervisaoTab.tsx` (modificar) | Coluna nova |
| `src/pages/performance/VendasTab.tsx` (modificar) | Coluna nova |
| `src/pages/performance/ClienteTab.tsx` (modificar) | Coluna nova, lendo a view de cliente |
| `src/pages/performance/EvolucaoGrafico.tsx` (modificar) | Meta como marcador sobre a série |

---

### Task 1: Migration 068 — views de hierarquia e de cliente

**Files:**
- Create: `docs/migrations/068_faturamento_mensal_hierarquia_cliente.sql`

**Interfaces:**
- Produces `alwayson_faturamento_v_mensal_hierarquia`: `distribuidor_id uuid`, `fornecedor_tenant_id uuid`, `nivel text` (`'gerente'|'supervisor'|'vendedor'`), `entidade_id uuid`, `mes date`, `faturamento numeric`, `nfs bigint`.
- Produces `alwayson_faturamento_v_mensal_cliente`: `distribuidor_id uuid`, `fornecedor_tenant_id uuid`, `cliente_id uuid`, `mes date`, `faturamento numeric`, `nfs bigint`.

- [ ] **Step 1: Escrever a migration**

O SQL abaixo foi validado contra o banco em 2026-08-11: os três níveis somam exatamente o total geral, sem vazamento nem dupla contagem.

```sql
-- 068: séries mensais por nível hierárquico e por cliente, para as minisséries
-- por linha da Performance (etapa 2).
--
-- Só faturamento e NFs, de propósito. São aditivos, então rolam pela hierarquia
-- sem mentir. `clientes_positivados` e `skus_distintos` NÃO rolam: um supervisor
-- com quatro vendedores atendendo o mesmo cliente contaria o cliente quatro
-- vezes. Quem precisa de distintos usa alwayson_faturamento_v_mensal (067),
-- onde eles são calculados e não somados.

DROP VIEW IF EXISTS alwayson_faturamento_v_mensal_hierarquia;

CREATE VIEW alwayson_faturamento_v_mensal_hierarquia
WITH (security_invoker = true) AS
WITH RECURSIVE ancestrais AS (
  -- Todo vendedor é ancestral de si próprio…
  SELECT id AS vendedor_id, id AS ancestral_id, tipo AS ancestral_tipo
  FROM alwayson_vendedores_distribuidor
  UNION ALL
  -- …e herda supervisor e, acima dele, gerente.
  SELECT a.vendedor_id, pai.id, pai.tipo
  FROM ancestrais a
  JOIN alwayson_vendedores_distribuidor filho ON filho.id = a.ancestral_id
  JOIN alwayson_vendedores_distribuidor pai   ON pai.id   = filho.supervisor_id
)
SELECT
  f.distribuidor_id,
  f.fornecedor_tenant_id,
  an.ancestral_tipo AS nivel,
  an.ancestral_id   AS entidade_id,
  date_trunc('month', f.data_emissao)::date AS mes,
  sum(f.valor_total)          AS faturamento,
  count(DISTINCT f.numero_nf) AS nfs
FROM alwayson_faturamento f
JOIN ancestrais an ON an.vendedor_id = f.vendedor_id
GROUP BY 1, 2, 3, 4, 5;

COMMENT ON VIEW alwayson_faturamento_v_mensal_hierarquia IS
  'Série mensal de faturamento por nível (gerente/supervisor/vendedor). Só métricas aditivas: distintos não rolam pela hierarquia.';

DROP VIEW IF EXISTS alwayson_faturamento_v_mensal_cliente;

CREATE VIEW alwayson_faturamento_v_mensal_cliente
WITH (security_invoker = true) AS
SELECT
  f.distribuidor_id,
  f.fornecedor_tenant_id,
  f.cliente_id,
  date_trunc('month', f.data_emissao)::date AS mes,
  sum(f.valor_total)          AS faturamento,
  count(DISTINCT f.numero_nf) AS nfs
FROM alwayson_faturamento f
GROUP BY 1, 2, 3, 4;

COMMENT ON VIEW alwayson_faturamento_v_mensal_cliente IS
  'Série mensal de faturamento por cliente, para a minissérie da aba Cliente.';
```

- [ ] **Step 2: Aplicar a migration**

```bash
npm run db:migrate
```

Se falhar por falta de `DATABASE_URL`, use o MCP Supabase `apply_migration` no projeto `osukbalwykbqvoumddxz`.

- [ ] **Step 3: Verificar que o rollup não vaza**

```sql
select nivel, count(distinct entidade_id) as entidades, count(*) as linhas,
       sum(faturamento)::numeric(14,2) as fat
from alwayson_faturamento_v_mensal_hierarquia group by nivel
union all
select 'cliente', count(distinct cliente_id), count(*), sum(faturamento)::numeric(14,2)
from alwayson_faturamento_v_mensal_cliente
union all
select 'CONTROLE', null, null, sum(valor_total)::numeric(14,2) from alwayson_faturamento
order by 1;
```

Esperado, exatamente:

| nivel | entidades | linhas | fat |
|---|---|---|---|
| CONTROLE | — | — | 15104043.07 |
| cliente | 2169 | 9719 | 15104043.07 |
| gerente | 4 | 63 | 15104043.07 |
| supervisor | 11 | 174 | 15104043.07 |
| vendedor | 79 | 1047 | 15104043.07 |

**Os cinco valores de `fat` têm de ser idênticos.** Se algum nível divergir, o CTE recursivo está a duplicar ou a perder linhas — não "corrija" ajustando números, reporte.

- [ ] **Step 4: Verificar `security_invoker` nas duas**

```sql
select relname, reloptions from pg_class
where relname in ('alwayson_faturamento_v_mensal_hierarquia',
                  'alwayson_faturamento_v_mensal_cliente');
```

Esperado: ambas com `security_invoker=true` em `reloptions`.

- [ ] **Step 5: Commit**

```bash
git add docs/migrations/068_faturamento_mensal_hierarquia_cliente.sql
git commit -m "feat(performance): views de série por hierarquia e por cliente

Só faturamento e NFs: são aditivos e rolam pela hierarquia sem mentir. Rollup
validado — os três níveis somam R\$ 15.104.043,07, igual ao total geral.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Hook das séries por entidade

**Files:**
- Create: `src/hooks/useSerieEntidade.ts`

**Interfaces:**
- Consumes: as views da Task 1; `Janela` de `src/lib/janela-periodo`.
- Produces:
  - `type NivelHierarquia = 'gerente' | 'supervisor' | 'vendedor'`
  - `interface SerieEntidade { valores: number[]; total: number }` — `valores` tem um item por mês da janela, na ordem de `janela.meses`, com `0` onde não houve faturamento.
  - `useSerieHierarquia(distribuidorId, nivel, janela)` → `Map<string, SerieEntidade>` indexado por `entidade_id`
  - `useSerieCliente(distribuidorId, janela)` → `Map<string, SerieEntidade>` indexado por `cliente_id`

- [ ] **Step 1: Escrever o hook**

```ts
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Janela } from '@/lib/janela-periodo'

export type NivelHierarquia = 'gerente' | 'supervisor' | 'vendedor'

export interface SerieEntidade {
  /** Um item por mês da janela, na ordem de `janela.meses`. 0 = sem faturamento. */
  valores: number[]
  total: number
}

type LinhaSerie = { chave: string; mes: string; faturamento: number }

/**
 * Monta o Map de séries a partir de linhas cruas.
 *
 * O preenchimento com 0 é deliberado e diferente do gráfico grande: ali um mês
 * sem contraparte é `null` para a linha interromper. Aqui, dentro da janela
 * escolhida, um mês sem faturamento é uma informação real — o vendedor não
 * vendeu — e a minissérie deve mostrar o vale, não um buraco.
 */
function montarSeries(linhas: LinhaSerie[], janela: Janela): Map<string, SerieEntidade> {
  const indicePorMes = new Map(janela.meses.map((m, i) => [m, i]))
  const out = new Map<string, SerieEntidade>()

  for (const l of linhas) {
    const mesChave = l.mes.slice(0, 7)
    const i = indicePorMes.get(mesChave)
    if (i === undefined) continue

    let serie = out.get(l.chave)
    if (!serie) {
      serie = { valores: new Array(janela.meses.length).fill(0), total: 0 }
      out.set(l.chave, serie)
    }
    serie.valores[i] += l.faturamento
    serie.total += l.faturamento
  }
  return out
}

const PAGE = 1000

/** Pagina uma view de série; sem isto o Supabase corta em 1000 linhas em silêncio. */
async function carregarPaginado(
  tabela: string,
  colunaChave: string,
  janela: Janela,
  distribuidorId: string | undefined,
  filtroExtra?: { coluna: string; valor: string }
): Promise<LinhaSerie[]> {
  const all: LinhaSerie[] = []
  let from = 0
  for (;;) {
    let q = supabase
      .from(tabela)
      .select(`${colunaChave}, mes, faturamento`)
      .gte('mes', `${janela.inicio}-01`)
      .lte('mes', `${janela.fim}-01`)
      .range(from, from + PAGE - 1)

    if (distribuidorId) q = q.eq('distribuidor_id', distribuidorId)
    if (filtroExtra) q = q.eq(filtroExtra.coluna, filtroExtra.valor)

    const { data, error } = await q
    if (error) throw error
    const chunk = data ?? []
    for (const row of chunk) {
      all.push({
        chave: String((row as Record<string, unknown>)[colunaChave]),
        mes: String((row as Record<string, unknown>).mes),
        faturamento: Number((row as Record<string, unknown>).faturamento),
      })
    }
    if (chunk.length < PAGE) break
    from += PAGE
  }
  return all
}

export function useSerieHierarquia(
  distribuidorId: string | undefined,
  nivel: NivelHierarquia,
  janela: Janela
) {
  return useQuery({
    queryKey: ['serie-hierarquia', distribuidorId ?? 'all', nivel, janela.inicio, janela.fim],
    queryFn: async () => {
      const linhas = await carregarPaginado(
        'alwayson_faturamento_v_mensal_hierarquia',
        'entidade_id',
        janela,
        distribuidorId,
        { coluna: 'nivel', valor: nivel }
      )
      return montarSeries(linhas, janela)
    },
  })
}

export function useSerieCliente(distribuidorId: string | undefined, janela: Janela) {
  return useQuery({
    queryKey: ['serie-cliente', distribuidorId ?? 'all', janela.inicio, janela.fim],
    queryFn: async () => {
      const linhas = await carregarPaginado(
        'alwayson_faturamento_v_mensal_cliente',
        'cliente_id',
        janela,
        distribuidorId
      )
      return montarSeries(linhas, janela)
    },
  })
}
```

- [ ] **Step 2: Verificar tipos**

```bash
npx tsc -b --noEmit
```

Esperado: sem saída.

- [ ] **Step 3: Verificar contra o banco**

```sql
select entidade_id, count(*) as meses, sum(faturamento)::numeric(14,2) as total
from alwayson_faturamento_v_mensal_hierarquia
where nivel = 'supervisor' and mes between '2025-08-01' and '2026-07-01'
group by entidade_id order by total desc limit 3;
```

Anote os três totais no seu report — são o que o hook tem de produzir em `SerieEntidade.total` para esses supervisores, na janela padrão de 12 meses.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useSerieEntidade.ts
git commit -m "feat(performance): hook das séries por entidade

Paginação explícita: sem ela o Supabase corta em 1000 linhas em silêncio, que
foi o bug que já mordeu o Insights. Meses sem faturamento viram 0, não null —
dentro da janela escolhida um vale é informação, não ausência de dado.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Minissérie SVG e coluna partilhada

**Files:**
- Create: `src/pages/performance/Minisserie.tsx`
- Create: `src/pages/performance/ColunaEvolucao.tsx`
- Modify: `src/pages/performance/sortableNumeric.tsx`

**Interfaces:**
- Consumes: `SerieEntidade` (Task 2).
- Produces:
  - `<Minisserie valores={number[]} className?={string} />`
  - `<ColunaEvolucao serie={SerieEntidade | undefined} variacao={number | null} />`
  - `sortableNumeric` passa a aceitar `'variacao'` em `PerfMetricKey`, e `useSortedMetricRows` a ordenar nulos sempre no fim.

- [ ] **Step 1: A minissérie**

`src/pages/performance/Minisserie.tsx`:

```tsx
/**
 * Sparkline em SVG inline — de propósito sem Recharts.
 *
 * Uma tabela de clientes pode ter milhares de linhas, e um ResponsiveContainer
 * por linha instala um ResizeObserver por linha. Aqui é um <path> e nada mais.
 */

const LARGURA = 64
const ALTURA = 18

interface Props {
  valores: number[]
  className?: string
}

export function Minisserie({ valores, className }: Props) {
  if (valores.length < 2) return null

  const max = Math.max(...valores)
  const min = Math.min(...valores)
  const amplitude = max - min || 1

  const passo = LARGURA / (valores.length - 1)
  const d = valores
    .map((v, i) => {
      const x = i * passo
      const y = ALTURA - ((v - min) / amplitude) * ALTURA
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  const ultimo = valores[valores.length - 1]
  const penultimo = valores[valores.length - 2]
  const subindo = ultimo >= penultimo

  return (
    <svg
      width={LARGURA}
      height={ALTURA}
      viewBox={`0 0 ${LARGURA} ${ALTURA}`}
      className={className}
      aria-hidden
      focusable="false"
    >
      <path
        d={d}
        fill="none"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={subindo ? 'stroke-success' : 'stroke-destructive'}
      />
    </svg>
  )
}
```

`aria-hidden` é deliberado: a minissérie é redundante face à variação numérica ao lado, que é lida por leitores de ecrã. Um `<path>` sem texto não acrescenta informação acessível.

- [ ] **Step 2: A célula partilhada**

`src/pages/performance/ColunaEvolucao.tsx`:

```tsx
import { TableCell } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { Minisserie } from './Minisserie'
import type { SerieEntidade } from '@/hooks/useSerieEntidade'

interface Props {
  serie: SerieEntidade | undefined
  /** Percentual já calculado; null quando não há contraparte. */
  variacao: number | null
  className?: string
}

export function ColunaEvolucao({ serie, variacao, className }: Props) {
  return (
    <TableCell className={cn('text-right tabular-nums', className)}>
      <div className="flex items-center justify-end gap-2">
        {variacao === null ? (
          <span className="text-xs text-muted-foreground">—</span>
        ) : (
          <span
            className={cn(
              'text-xs font-semibold',
              variacao >= 0 ? 'text-success' : 'text-destructive'
            )}
          >
            {variacao >= 0 ? '+' : ''}
            {variacao.toFixed(1)}%
          </span>
        )}
        {serie && <Minisserie valores={serie.valores} />}
      </div>
    </TableCell>
  )
}
```

O `—` para variação ausente é o mesmo vocabulário já usado na tela para "não há dado", e distingue-se de `0.0%`, que significa "não mudou".

No mesmo arquivo, exporte o helper que as cinco tabelas vão usar para calcular a variação de cada linha:

```ts
/** Variação do total da janela contra o total da comparação; null sem contraparte. */
export function calcularVariacaoLinha(
  atual: SerieEntidade | undefined,
  anterior: SerieEntidade | undefined
): number | null {
  if (!atual || !anterior || anterior.total === 0) return null
  return ((atual.total - anterior.total) / anterior.total) * 100
}
```

Ele vive aqui, e não em cada tabela, porque as cinco precisam exatamente da mesma regra — incluindo a de que ausência de contraparte é `null` e nunca `0`.

- [ ] **Step 3: Ordenação por variação**

Em `src/pages/performance/sortableNumeric.tsx`, estenda o tipo:

```ts
export type PerfMetricKey = 'faturamento' | 'positivados' | 'itens' | 'pedidos' | 'variacao'
```

E em `useSortedMetricRows`, troque o comparador por um que empurre nulos para o fim **nas duas direções** — quem ordena por variação quer ver quem mais subiu ou quem mais caiu, e linhas sem comparação não são nem uma coisa nem outra:

```ts
  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      const va = a[sortField]
      const vb = b[sortField]
      const na = va === null || va === undefined
      const nb = vb === null || vb === undefined
      if (na && nb) return 0
      if (na) return 1   // nulos sempre no fim…
      if (nb) return -1  // …independentemente da direção
      const cmp = Number(va) - Number(vb)
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [rows, sortField, sortDir])
```

Isto exige relaxar a restrição do genérico, que hoje é `T extends Record<PerfMetricKey, number>`: `variacao` pode ser `null`. Troque para `T extends Partial<Record<PerfMetricKey, number | null>>` e confirme que os consumidores existentes continuam a compilar.

- [ ] **Step 4: Verificar tipos**

```bash
npx tsc -b --noEmit
```

Esperado: sem saída. Se algum tab acusar erro no genérico, ajuste o tipo da linha desse tab — não relaxe o comparador com `any`.

- [ ] **Step 5: Commit**

```bash
git add src/pages/performance/Minisserie.tsx src/pages/performance/ColunaEvolucao.tsx src/pages/performance/sortableNumeric.tsx
git commit -m "feat(performance): minissérie SVG e coluna de evolução partilhada

SVG inline e não Recharts: uma tabela de clientes tem milhares de linhas, e um
ResponsiveContainer por linha instala um ResizeObserver por linha.

Nulos de variação ordenam sempre no fim, nas duas direções — sem comparação não
é nem subida nem queda.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Ligar nas quatro abas de hierarquia

**Files:**
- Modify: `src/pages/performance/DistribuidorTab.tsx`
- Modify: `src/pages/performance/GerenciaTab.tsx`
- Modify: `src/pages/performance/SupervisaoTab.tsx`
- Modify: `src/pages/performance/VendasTab.tsx`
- Modify: `src/hooks/useSerieEntidade.ts` (só visibilidade — ver Step 0)

**Interfaces:**
- Consumes: `useSerieHierarquia` (Task 2), `ColunaEvolucao` (Task 3), `calcularJanela`/`calcularComparacao` (etapa 1), `useFaturamentoMensal` (etapa 1, `src/hooks/useFaturamentoMensal.ts`).

⚠️ **`DistribuidorTab` é o caso especial.** As outras três listam entidades da hierarquia; esta lista **distribuidores**, que não estão em `alwayson_vendedores_distribuidor`. Para ela, use `alwayson_faturamento_v_mensal` (a view da etapa 1, migration 067) filtrando `eh_total_distribuidor = true` e agrupando por `distribuidor_id` — não invente um nível novo na view de hierarquia.

⚠️ **`DistribuidorTab.tsx` hoje não chama `useFaturamentoMensal` em lugar nenhum** — a
tabela usa `useAllFaturamentoSales` (linha a linha) e `aggregateSalesBy`. Só
`EvolucaoResumo`/`EvolucaoGrafico`, que são componentes à parte, chamam
`useFaturamentoMensal`, e cada um com o seu próprio hook, escopado a
`filters.distribuidorId`. O Step 3 abaixo faz **duas chamadas novas** a
`useFaturamentoMensal`, com `distribuidorId` sempre `undefined` — a tabela lista
**todos** os distribuidores independentemente do filtro (a lista vem de
`useDistribuidores()`, sem argumento), então a série tem de vir sem filtro
também, e ser agrupada por `distribuidor_id` no cliente.

- [ ] **Step 0: Exportar `montarSeries`**

Em `src/hooks/useSerieEntidade.ts`, acrescente `export` a `montarSeries` e ao
tipo `LinhaSerie` que ela recebe (hoje ambos são privados ao módulo):

```ts
export type LinhaSerie = { chave: string; mes: string; faturamento: number }

// …

export function montarSeries(linhas: LinhaSerie[], janela: Janela): Map<string, SerieEntidade> {
```

Sem alteração de lógica — é só visibilidade, para o Step 3 poder reutilizá-la em
vez de duplicar o agrupamento.

- [ ] **Step 1: Cabeçalho e célula em `VendasTab`** (faça esta primeiro; é o caso canónico)

Acrescente ao `<TableHeader>`, depois de `Faturamento`:

```tsx
              <SortableNumericHead
                label="Evolução"
                field="variacao"
                sortField={sortField}
                sortDir={sortDir}
                onSort={toggleSort}
                className="hidden lg:table-cell"
              />
```

No corpo, dentro do `map` das linhas, depois da célula de faturamento:

```tsx
                  <ColunaEvolucao
                    serie={series?.get(row.id)}
                    variacao={row.variacao}
                    className="hidden lg:table-cell"
                  />
```

E no componente, antes do `useMemo` das linhas:

```tsx
  const janela = calcularJanela(filters.janela)
  const comparacao = calcularComparacao(janela, filters.comparar)
  const { data: series } = useSerieHierarquia(filters.distribuidorId, 'vendedor', janela)
  const { data: seriesAnterior } = useSerieHierarquia(
    filters.distribuidorId,
    'vendedor',
    comparacao ?? janela
  )
```

E dentro do `useMemo` que monta `rows`, acrescente a cada linha:

```tsx
        variacao: calcularVariacaoLinha(
          series?.get(dado.id),
          comparacao ? seriesAnterior?.get(dado.id) : undefined
        ),
```

`calcularVariacaoLinha` já existe desde a Task 3 — importe-a de `./ColunaEvolucao`, não a redefina aqui.

- [ ] **Step 2: Repetir em `GerenciaTab` e `SupervisaoTab`**

Idêntico ao Step 1, trocando o nível: `'gerente'` em `GerenciaTab`, `'supervisor'` em `SupervisaoTab`. A chave do `Map` é o `id` da entidade em ambos.

- [ ] **Step 3: `DistribuidorTab`, pelo caminho da view 067**

Adicione o import:

```ts
import { useFaturamentoMensal } from '@/hooks/useFaturamentoMensal'
import { montarSeries } from '@/hooks/useSerieEntidade'
import { calcularJanela, calcularComparacao } from '@/lib/janela-periodo'
```

Antes do `useMemo` que monta `rows`, acrescente as duas chamadas — sempre com
`distribuidorId: undefined`, porque esta tabela lista todos os distribuidores:

```tsx
  const janela = calcularJanela(filters.janela)
  const comparacao = calcularComparacao(janela, filters.comparar)
  const { data: mensal } = useFaturamentoMensal(undefined, janela)
  const { data: mensalAnterior } = useFaturamentoMensal(undefined, comparacao ?? janela)

  const series = useMemo(
    () =>
      montarSeries(
        (mensal ?? []).map((r) => ({ chave: r.distribuidor_id, mes: r.mes, faturamento: r.faturamento })),
        janela
      ),
    [mensal, janela]
  )
  const seriesAnterior = useMemo(
    () =>
      montarSeries(
        (mensalAnterior ?? []).map((r) => ({ chave: r.distribuidor_id, mes: r.mes, faturamento: r.faturamento })),
        comparacao ?? janela
      ),
    [mensalAnterior, comparacao, janela]
  )
```

Dentro do `useMemo` que monta `rows`, ao lado de `faturamento`/`positivados`/etc.
de cada `dist`, acrescente:

```tsx
        variacao: calcularVariacaoLinha(
          series.get(dist.id),
          comparacao ? seriesAnterior.get(dist.id) : undefined
        ),
```

E no `<TableRow>`, a mesma `<SortableNumericHead field="variacao">` e
`<ColunaEvolucao serie={series.get(row.id)} variacao={row.variacao} />` do Step
1 — `row.id` aqui é `distribuidor_id`, já presente em `dist.id` porque `rows`
faz `{...dist, faturamento: ..., variacao: ...}`.

Note a diferença do Step 1: ali `series`/`seriesAnterior` vêm direto de
`useSerieHierarquia` (já são `Map`); aqui vêm de `montarSeries` chamada
manualmente, porque a view 067 não tem uma dimensão "nível" para filtrar por
`useSerieHierarquia`.

- [ ] **Step 4: Verificar tipos**

```bash
npx tsc -b --noEmit
```

- [ ] **Step 5: Conferir os números contra o banco**

```sql
select entidade_id,
       sum(faturamento) filter (where mes between '2025-08-01' and '2026-07-01')::numeric(14,2) as atual,
       sum(faturamento) filter (where mes between '2024-08-01' and '2025-07-01')::numeric(14,2) as anterior
from alwayson_faturamento_v_mensal_hierarquia
where nivel = 'vendedor'
group by entidade_id
having sum(faturamento) filter (where mes between '2024-08-01' and '2025-07-01') > 0
order by 2 desc limit 5;
```

Calcule à mão a variação dos cinco e ponha no report. São os valores que a coluna "Evolução" da aba Vendas tem de mostrar. Note que muitos vendedores vão ter `anterior` nulo — a série começa em jan/2025 e a janela de comparação padrão vai até ago/2024, então a coluna mostrará `—` para eles. Isso é correto, não bug.

- [ ] **Step 6: Commit**

```bash
git add src/pages/performance/DistribuidorTab.tsx src/pages/performance/GerenciaTab.tsx src/pages/performance/SupervisaoTab.tsx src/pages/performance/VendasTab.tsx src/hooks/useSerieEntidade.ts
git commit -m "feat(performance): coluna de evolução nas abas de hierarquia

Ordenar por ela responde quem puxou o crescimento e quem cai contra o próprio
ano anterior. DistribuidorTab lê a view 067 e não a de hierarquia — distribuidor
não é entidade de alwayson_vendedores_distribuidor — e monta a série chamando
useFaturamentoMensal sem filtro, já que a tabela lista todos os distribuidores.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Ligar na aba Cliente

**Files:**
- Modify: `src/pages/performance/ClienteTab.tsx`

**Interfaces:**
- Consumes: `useSerieCliente` (Task 2), `ColunaEvolucao` e `calcularVariacaoLinha` (Tasks 3–4).

⚠️ **`ClienteTab` NÃO usa `useSortedMetricRows`/`PerfMetricKey` como as outras
quatro abas.** Tem ordenação própria: `useNumericSort<'faturamento_mes'>` com um
comparador inline que lê `resumoMap.get(a.id)?.faturamentoPeriodo`
(`ClienteTab.tsx:112-119`). "Mesmo padrão da Task 4" não se aplica ao mecanismo
de ordenação — só ao `SortableNumericHead`/`ColunaEvolucao` visuais. Não force
este arquivo a adotar `useSortedMetricRows`; estenda o que já existe.

- [ ] **Step 1: Ligar a série**

`useSerieCliente(filters.distribuidorId, janela)` e o `Map` indexado por
`cliente_id`. A chave da linha nesta tabela é o `id` do cliente — confirme lendo
o `useMemo` que monta as linhas antes de escrever.

- [ ] **Step 2: Cabeçalho e célula**

Mesmo `SortableNumericHead` visualmente, com `field="variacao"` e mesma
`<ColunaEvolucao />`, ambos com `className="hidden lg:table-cell"`. Mas a
ordenação em si segue o mecanismo próprio deste arquivo: troque
`useNumericSort<'faturamento_mes'>` por
`useNumericSort<'faturamento_mes' | 'variacao'>`, e no comparador de
`sortedRows` acrescente o ramo para `sortField === 'variacao'`, lendo o mapa de
variações que você montou no Step 1 — com nulos sempre no fim, na mesma política
adotada em `useSortedMetricRows` (Task 3, Step 3): sem contraparte não é nem
subida nem queda, então nunca aparece no topo em nenhuma direção.

- [ ] **Step 3: Verificar tipos**

```bash
npx tsc -b --noEmit
```

- [ ] **Step 4: Conferir volume**

```sql
select count(*) as linhas_na_janela
from alwayson_faturamento_v_mensal_cliente
where mes between '2025-08-01' and '2026-07-01';
```

Ponha o número no report. Se passar de 1000, é a prova de que a paginação da Task 2 é necessária — confirme que `carregarPaginado` está mesmo a ser usado neste caminho e não uma query simples.

- [ ] **Step 5: Commit**

```bash
git add src/pages/performance/ClienteTab.tsx
git commit -m "feat(performance): coluna de evolução na aba Cliente

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Meta como marcador sobre a série

**Files:**
- Modify: `src/pages/performance/EvolucaoGrafico.tsx`

O spec tirou a meta dos cards e prometeu-a de volta aqui, como marcador. Há meta em apenas três meses (2026-05, 2026-06, 2026-08) e **falta julho** — o buraco tem de aparecer como ausência, nunca como zero.

**Interfaces:**
- Consumes: `useMetas` (`src/hooks/useMetas.ts`) — leia a assinatura antes de usar; metas leem-se pela view `alwayson_metas_v_acompanhamento`, nunca pela tabela.

- [ ] **Step 1: Trazer as metas do período**

Carregue as metas do distribuidor no intervalo da janela, agregue-as por mês (soma dos valores de meta do nível de topo — não some níveis diferentes, senão conta duas vezes) e junte ao array `dados` do gráfico como uma chave `meta`, com `null` nos meses sem meta.

- [ ] **Step 2: Desenhar o marcador**

Acrescente ao `<LineChart>`, **depois** das linhas existentes para ficar por cima:

```tsx
          <Line
            type="monotone"
            dataKey="meta"
            name="Meta"
            strokeWidth={1.5}
            strokeDasharray="2 3"
            dot={{ r: 3 }}
            connectNulls={false}
          />
```

`connectNulls={false}` outra vez, e pela mesma razão: julho não tem meta, e uma linha que atravessa o buraco afirmaria que tinha.

- [ ] **Step 3: Verificar tipos e o buraco**

```bash
npx tsc -b --noEmit
```

```sql
select to_char(periodo_inicio,'YYYY-MM') as mes, count(*), sum(valor_meta)::numeric(14,2)
from alwayson_metas_distribuidor group by 1 order by 1;
```

Esperado: linhas para 2026-05, 2026-06 e 2026-08 — e **nenhuma** para 2026-07. Confirme no report que o seu `dados` tem `meta: null` em julho.

- [ ] **Step 4: Commit**

```bash
git add src/pages/performance/EvolucaoGrafico.tsx
git commit -m "feat(performance): meta como marcador sobre a série

Volta onde o spec a colocou, depois de sair dos cards. Julho não tem meta e o
marcador interrompe ali — atravessar o buraco afirmaria que tinha.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Verificação final da etapa

- [ ] **Critério 2 do spec** — ordenar a tabela de vendedores por Evolução identifica quem sustenta o crescimento.
- [ ] **Critério 4 do spec** — o drill-down por URL continua a funcionar: Distribuidor → Gerência → Supervisão → Vendas → Cliente, com os parâmetros a acompanhar e o breadcrumb a voltar.
- [ ] Os cinco níveis somam o mesmo total (SQL da Task 1, Step 3).
- [ ] Nenhum UUID visível em nenhuma tabela ou filtro.
- [ ] A coluna Evolução mostra `—`, e não `0.0%`, para linhas sem contraparte.

## O que fica fora

- Clientes únicos na janela (a faixa de topo mostra média mensal) — ver a limitação registada na etapa 1.
- Minissérie de positivados ou itens: não são aditivos e não rolam pela hierarquia.
