# Gráfico por nível + busca/filtros/paginação em Cliente — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar a Gerência/Supervisão/Vendas um gráfico com uma linha por entidade filha (clicável, drill-down), simplificar o filtro de Vendas, e dar à aba Cliente busca, filtro de classificação, filtro de cidade/UF, densidade de linha e paginação — sem regredir a ordenação que as 5 abas já têm hoje.

**Architecture:** Um componente novo (`EvolucaoGraficoNivel`) reaproveita as séries que cada tab já busca (`useSerieHierarquia`) para desenhar N linhas + "Outros"; três tabs ganham uma linha de import e um `<EvolucaoGraficoNivel>` a mais, sem hook novo. Em Cliente, busca/classificação/cidade são filtros locais em cima do array já carregado (`useClientes` traz tudo de uma vez), aplicados **antes** da ordenação já existente, que por sua vez roda **antes** da paginação — nessa ordem, sempre.

**Tech Stack:** React 19 + Vite, Recharts 3.8, TanStack Query, Supabase, Tailwind + shadcn/ui.

## Global Constraints

- **Sem framework de teste neste repo.** Não existe vitest/jest nem nenhum `*.test.*`. Não crie um. Verificação é `npx tsc -b --noEmit`, SQL contra o banco (MCP Supabase), e traço de lógica com script descartável quando não dá para rodar no browser.
- **Sem sessão autenticada disponível para os agentes.** Não inicie `npm run dev`, não tente verificação visual. Todo passo de browser é responsabilidade do usuário depois.
- **Nunca expor UUID na UI.**
- **As colunas numéricas das 5 abas já são todas ordenáveis hoje** (Faturamento/Positivados/Itens/Pedidos/Evolução nas 4 de hierarquia; Faturamento(período)/Evolução em Cliente). Isso é restrição a preservar, não tarefa: **ordenar sempre roda sobre o array filtrado completo, e só depois é que pagina** — pipeline fixo `filtrar → ordenar → paginar → renderizar`. Inverter a ordem faria ordenar só reordenar dentro de uma página.
- **Não editar `src/components/ui/table.tsx`** (componente compartilhado por todo o app). Densidade de linha é override de `className` por instância em `ClienteTab.tsx`, via `cn()`/`twMerge` — nunca mudança no padding default.
- **`usePagination`/`<PaginationBar>` já existem** (`src/hooks/usePagination.ts`, `src/components/ui/pagination-bar.tsx`) — mesmo par usado em `InsightsPanel.tsx`. Não criar paginação nova.
- Commits em português, terminando com `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- **Specs de origem:** `docs/superpowers/specs/2026-08-11-performance-grafico-nivel-design.md` e `docs/superpowers/specs/2026-08-11-performance-cliente-busca-filtros-design.md`.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `src/pages/performance/EvolucaoGraficoNivel.tsx` (criar) | Gráfico com N linhas + Outros, clicável |
| `src/pages/performance/GerenciaTab.tsx` (modificar) | Monta o gráfico |
| `src/pages/performance/SupervisaoTab.tsx` (modificar) | Monta o gráfico |
| `src/pages/performance/VendasTab.tsx` (modificar) | Monta o gráfico; remove filtro Gerente |
| `src/lib/cliente-sinalizadores.ts` (modificar) | Exporta predicado de classificação, reaproveitado pelo filtro |
| `src/pages/performance/ClienteTab.tsx` (modificar) | Busca, filtros de classificação/cidade, paginação, densidade |

---

### Task 1: `EvolucaoGraficoNivel` — gráfico com N linhas + Outros

**Files:**
- Create: `src/pages/performance/EvolucaoGraficoNivel.tsx`

**Interfaces:**
- Consumes: `SerieEntidade` (`src/hooks/useSerieEntidade.ts`, `{valores: number[]; total: number}`), `Janela`/`PRIMEIRO_MES_SERIE` (`src/lib/janela-periodo.ts`), `InsightsChartCard`/`CHART_AXIS_TICK`/`CHART_GRID_STROKE`/`INSIGHTS_CHART_COLORS`/`formatCurrencyCompact`/`coerceTooltipNumber` (`src/components/insights/charts`, já usados por `EvolucaoGrafico.tsx`).
- Produces: `<EvolucaoGraficoNivel janela comparacao entidades series seriesAnterior onEntidadeClick />`.

- [ ] **Step 1: Escrever o componente**

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
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/format'
import { PRIMEIRO_MES_SERIE, type Janela } from '@/lib/janela-periodo'
import type { SerieEntidade } from '@/hooks/useSerieEntidade'
import {
  InsightsChartCard,
  CHART_AXIS_TICK,
  CHART_GRID_STROKE,
  INSIGHTS_CHART_COLORS,
  formatCurrencyCompact,
  coerceTooltipNumber,
} from '@/components/insights/charts'

const MES_CURTO = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez',
]

function rotuloMes(mesIso: string): string {
  const [ano, mes] = mesIso.split('-').map(Number)
  return `${MES_CURTO[mes - 1]}/${String(ano).slice(2)}`
}

const TOP_N = 5
const OUTROS_ID = '__outros__'

interface EntidadeNome {
  id: string
  nome: string
}

interface Props {
  janela: Janela
  comparacao: Janela | null
  /** Todas as entidades do nível — a mesma lista já pré-filtrada por
   * hierarquia que a tabela do tab usa (ex.: `filteredSupervisores`). */
  entidades: EntidadeNome[]
  series: Map<string, SerieEntidade> | undefined
  seriesAnterior: Map<string, SerieEntidade> | undefined
  /** Mesmo handler que o clique da linha da tabela já usa. Nunca chamado
   * para "Outros" — não há entidade única para navegar. */
  onEntidadeClick: (id: string) => void
}

export function EvolucaoGraficoNivel({
  janela,
  comparacao,
  entidades,
  series,
  seriesAnterior,
  onEntidadeClick,
}: Props) {
  const { top, temOutros } = useMemo(() => {
    const ranked = [...entidades].sort(
      (a, b) => (series?.get(b.id)?.total ?? 0) - (series?.get(a.id)?.total ?? 0)
    )
    return { top: ranked.slice(0, TOP_N), temOutros: ranked.length > TOP_N }
  }, [entidades, series])

  const outrosIds = useMemo(() => {
    if (!temOutros) return []
    const topIds = new Set(top.map((e) => e.id))
    return entidades.filter((e) => !topIds.has(e.id)).map((e) => e.id)
  }, [entidades, top, temOutros])

  // Meses do intervalo de comparação anteriores ao início real da série: ali
  // não há linha nenhuma, mesmo que SerieEntidade preencha com 0 — 0 ali
  // significaria "vendeu zero", que é diferente de "não existe dado". A
  // máscara é explícita porque connectNulls só interrompe em cima de null.
  const semDadoAnterior = useMemo(() => {
    if (!comparacao) return []
    return comparacao.meses.map((mes) => mes < PRIMEIRO_MES_SERIE)
  }, [comparacao])

  const dados = useMemo(() => {
    return janela.meses.map((mes, i) => {
      const ponto: Record<string, string | number | null> = { mes: rotuloMes(mes) }

      for (const entidade of top) {
        ponto[entidade.id] = series?.get(entidade.id)?.valores[i] ?? 0
        if (comparacao) {
          ponto[`${entidade.id}::anterior`] = semDadoAnterior[i]
            ? null
            : (seriesAnterior?.get(entidade.id)?.valores[i] ?? 0)
        }
      }

      if (temOutros) {
        ponto[OUTROS_ID] = outrosIds.reduce(
          (soma, id) => soma + (series?.get(id)?.valores[i] ?? 0),
          0
        )
        if (comparacao) {
          ponto[`${OUTROS_ID}::anterior`] = semDadoAnterior[i]
            ? null
            : outrosIds.reduce(
                (soma, id) => soma + (seriesAnterior?.get(id)?.valores[i] ?? 0),
                0
              )
        }
      }

      return ponto
    })
  }, [janela, comparacao, top, outrosIds, temOutros, series, seriesAnterior, semDadoAnterior])

  if (top.length === 0) return null

  const linhas: EntidadeNome[] = temOutros ? [...top, { id: OUTROS_ID, nome: 'Outros' }] : top
  const clicavel = (id: string) => id !== OUTROS_ID

  return (
    <InsightsChartCard title="Faturamento mês a mês" height={280} className="mb-4">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={dados} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
          <CartesianGrid stroke={CHART_GRID_STROKE} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="mes" tick={CHART_AXIS_TICK} />
          <YAxis
            tick={CHART_AXIS_TICK}
            tickFormatter={(v: number) => formatCurrencyCompact(v)}
          />
          <Tooltip
            formatter={((value: unknown) => formatCurrency(coerceTooltipNumber(value))) as never}
            contentStyle={{
              borderRadius: 8,
              border: '1px solid var(--color-border)',
              fontSize: 12,
            }}
          />
          <Legend
            iconType="circle"
            wrapperStyle={{ fontSize: 11, paddingTop: 4 }}
            onClick={(entry) => {
              const id = typeof entry.dataKey === 'string' ? entry.dataKey : ''
              if (clicavel(id)) onEntidadeClick(id)
            }}
            formatter={(value: string, entry: { dataKey?: string | number }) => {
              const id = typeof entry.dataKey === 'string' ? entry.dataKey : ''
              return (
                <span
                  className={cn(
                    'text-xs text-muted-foreground',
                    clicavel(id) && 'cursor-pointer hover:text-foreground'
                  )}
                >
                  {value}
                </span>
              )
            }}
          />
          {linhas.map((entidade, i) => {
            const cor = INSIGHTS_CHART_COLORS[i % INSIGHTS_CHART_COLORS.length]
            return (
              <Line
                key={entidade.id}
                type="monotone"
                dataKey={entidade.id}
                name={entidade.nome}
                stroke={cor}
                strokeWidth={2}
                dot={{ r: 3 }}
                onClick={() => clicavel(entidade.id) && onEntidadeClick(entidade.id)}
                style={clicavel(entidade.id) ? { cursor: 'pointer' } : undefined}
              />
            )
          })}
          {comparacao &&
            linhas.map((entidade, i) => {
              const cor = INSIGHTS_CHART_COLORS[i % INSIGHTS_CHART_COLORS.length]
              return (
                <Line
                  key={`${entidade.id}::anterior`}
                  type="monotone"
                  dataKey={`${entidade.id}::anterior`}
                  legendType="none"
                  stroke={cor}
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={false}
                  connectNulls={false}
                />
              )
            })}
        </LineChart>
      </ResponsiveContainer>
    </InsightsChartCard>
  )
}
```

⚠️ Pontos que não são estilo, são correção:
- A cor de uma linha vem do **índice dela em `linhas`**, o mesmo array usado tanto para as linhas sólidas quanto as tracejadas — é isso que garante que o traço tracejado de uma entidade tenha a mesma cor do seu traço sólido.
- `semDadoAnterior` é calculado uma vez, não por entidade — o "não existe dado" é sobre o **mês**, não sobre quem vendeu.
- "Outros" aparece na legenda (rotulado), só não é clicável — `clicavel()` decide o cursor e o handler, não a visibilidade.

- [ ] **Step 2: Verificar tipos**

```bash
npx tsc -b --noEmit
```

Esperado: sem saída.

- [ ] **Step 3: Traçar a lógica de ranking e máscara com dados reais**

Sem browser, prove que o componente produziria o resultado certo para um caso real. Use o MCP Supabase (`execute_sql`, projeto `osukbalwykbqvoumddxz`) para pegar os totais reais de faturamento por supervisor na janela padrão de 6 meses:

```sql
select entidade_id,
       sum(faturamento) filter (where mes between '2026-02-01' and '2026-07-01')::numeric(14,2) as total
from alwayson_faturamento_v_mensal_hierarquia
where nivel = 'supervisor'
group by entidade_id
order by total desc;
```

Com o resultado (11 supervisores), confirme à mão: os 5 primeiros por `total` são o `top`; os outros 6 são os que `outrosIds` deveria conter; a soma dos 6 restantes é o valor que apareceria na linha "Outros" para o mês de julho/2026. Ponha os 3 números (top5 IDs, outrosIds, soma de outros em julho) no report.

Depois, confirme a máscara `semDadoAnterior`: com janela padrão (6 meses, ago/2024 até fev/2025 seria a comparação de ano anterior de uma janela fev-jul/2026 — calcule a partir de `calcularJanela(6)`/`calcularComparacao` como no relatório da etapa 1) quais meses da comparação caem antes de `PRIMEIRO_MES_SERIE = '2025-01'` e por isso devem virar `null`, não `0`.

- [ ] **Step 4: Commit**

```bash
git add src/pages/performance/EvolucaoGraficoNivel.tsx
git commit -m "feat(performance): gráfico com N linhas por nível, top 5 + Outros

Reaproveita as mesmas séries que a coluna Evolução da tabela já busca — sem
fetch novo. Cor por entidade, traço por período (sólido=atual,
tracejado=anterior). Meses da comparação anteriores a PRIMEIRO_MES_SERIE viram
null explicitamente — SerieEntidade preenche com 0 dentro da janela, que
significaria 'vendeu zero', diferente de 'não existe dado'.

Clique em linha ou legenda aplica o mesmo handler de drill-down que a linha da
tabela já usa. Outros aparece rotulado mas não é clicável.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Ligar o gráfico em Gerência/Supervisão/Vendas + simplificar filtro de Vendas

**Files:**
- Modify: `src/pages/performance/GerenciaTab.tsx`
- Modify: `src/pages/performance/SupervisaoTab.tsx`
- Modify: `src/pages/performance/VendasTab.tsx`

**Interfaces:**
- Consumes: `EvolucaoGraficoNivel` (Task 1).

Os três arquivos já calculam exatamente a lista de entidades certa a passar — `hierarchy.gerentes` em Gerência, `filteredSupervisores` em Supervisão, `filteredVendedores` em Vendas — e já têm `series`/`seriesAnterior`/`janela`/`comparacao`/`handleRowClick` prontos. Não é preciso computar nada novo.

- [ ] **Step 1: `GerenciaTab.tsx` (caso canônico)**

Import:
```ts
import { EvolucaoGraficoNivel } from './EvolucaoGraficoNivel'
```

Entre o `</KPIGrid>` e o `<Card>` (linha 114-116 do arquivo atual):
```tsx
      <EvolucaoGraficoNivel
        janela={janela}
        comparacao={comparacao}
        entidades={hierarchy?.gerentes ?? []}
        series={series}
        seriesAnterior={seriesAnterior}
        onEntidadeClick={handleRowClick}
      />
```

- [ ] **Step 2: `SupervisaoTab.tsx`**

Mesmo import. Entre `</KPIGrid>` e `<Card>`:
```tsx
      <EvolucaoGraficoNivel
        janela={janela}
        comparacao={comparacao}
        entidades={filteredSupervisores}
        series={series}
        seriesAnterior={seriesAnterior}
        onEntidadeClick={handleRowClick}
      />
```

- [ ] **Step 3: `VendasTab.tsx` — chart + remover filtro Gerente**

Mesmo import. Entre `</KPIGrid>` e `<Card>`:
```tsx
      <EvolucaoGraficoNivel
        janela={janela}
        comparacao={comparacao}
        entidades={filteredVendedores}
        series={series}
        seriesAnterior={seriesAnterior}
        onEntidadeClick={handleRowClick}
      />
```

Agora a simplificação do filtro. Remova `gerentesForFilter` (linhas 62-65) e `showGerenteFilter` (linha 146) inteiramente — não são mais usados em lugar nenhum deste arquivo depois desta mudança.

Troque o bloco `filterColumns`/`FilterBar` (linhas 146-218 do arquivo atual) por:

```tsx
  const showSupervisorFilter = supervisoresForFilter.length > 0

  return (
    <div className="space-y-6 mt-4">
      {showSupervisorFilter && (
        <FilterBar columns={2}>
          <FilterField label="Supervisor">
            <Select
              value={supervisorId ?? 'todos'}
              onValueChange={(v) =>
                setFilter(
                  'supervisorId',
                  v === 'todos' ? undefined : (v as string)
                )
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
        </FilterBar>
      )}
```

`columns={2}` (não `1` — `FilterBar` só aceita `2 | 3 | 4`, o mesmo padrão que `SupervisaoTab.tsx` já usa para o filtro único de Gerente ali). `gerenteId` continua existindo em `filters` — chega pelo drill-down (Gerência → Supervisão → Vendas) e continua sendo passado ao `drillDown` no clique da linha; não toque nesse fluxo, só a `FilterBar`/`FilterField` de Gerente é removida.

- [ ] **Step 4: Verificar tipos**

```bash
npx tsc -b --noEmit
```

Esperado: sem saída. Se `gerentesForFilter`/`showGerenteFilter` aparecerem como "declared but never used", é sinal de que a remoção do Step 3 ficou incompleta.

- [ ] **Step 5: Conferir a lista de entidades passada ao gráfico bate com a tabela**

```sql
select count(*) from alwayson_vendedores_distribuidor
where tipo = 'gerente' and ativo;
```

Confirme no report que esse número bate com `hierarchy.gerentes.length` (4, conforme já verificado na etapa 2) — é a lista que `EvolucaoGraficoNivel` recebe em `GerenciaTab`, e com 4 entidades "Outros" nunca deve aparecer lá (`temOutros` só é `true` acima de 5).

- [ ] **Step 6: Commit**

```bash
git add src/pages/performance/GerenciaTab.tsx src/pages/performance/SupervisaoTab.tsx src/pages/performance/VendasTab.tsx
git commit -m "feat(performance): gráfico por nível em Gerência/Supervisão/Vendas

Reaproveita janela/comparacao/series/seriesAnterior/handleRowClick que cada tab
já calculava para a coluna Evolução da tabela. Nenhum hook novo.

Vendas perde o dropdown de Gerente na barra de filtros — gerenteId continua
chegando pelo drill-down e sendo repassado ao clique da linha, só o atalho de
trocar de gerente sem sair da aba desaparece.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Busca + filtro de Classificação + filtro de Cidade/UF em Cliente

**Files:**
- Modify: `src/lib/cliente-sinalizadores.ts`
- Modify: `src/pages/performance/ClienteTab.tsx`

**Interfaces:**
- Produces (em `cliente-sinalizadores.ts`): `type ClassificacaoFiltro = 'novo' | 'top' | 'em_risco' | 'sem_compra'`; `CLASSIFICACAO_FILTRO_LABELS: Record<ClassificacaoFiltro, string>`; `clienteTemClassificacao(filtro, cliente, resumo, isTopComprador): boolean`.

- [ ] **Step 1: Predicado de classificação, ao lado do que já monta os badges**

Em `src/lib/cliente-sinalizadores.ts`, acrescente depois de `isClienteNovo`:

```ts
export type ClassificacaoFiltro = 'novo' | 'top' | 'em_risco' | 'sem_compra'

export const CLASSIFICACAO_FILTRO_LABELS: Record<ClassificacaoFiltro, string> = {
  novo: 'Novo',
  top: 'Top comprador',
  em_risco: 'Em risco',
  sem_compra: `Sem compra ${SEM_COMPRA_DIAS_LIMIAR}d+`,
}

/**
 * Mesma condição que decide se o badge aparece na linha — o filtro de
 * Classificação usa esta função, não uma cópia. Se um dia a regra do badge
 * mudar, o filtro muda junto, de graça.
 */
export function clienteTemClassificacao(
  filtro: ClassificacaoFiltro,
  cliente: ClienteDistribuidor,
  resumo: ClienteFatResumo | undefined,
  isTopComprador: boolean
): boolean {
  switch (filtro) {
    case 'novo':
      return isClienteNovo(resumo)
    case 'top':
      return isTopComprador
    case 'em_risco':
      return cliente.status === 'em_risco'
    case 'sem_compra':
      return (
        (resumo?.diasSemCompra ?? 0) > SEM_COMPRA_DIAS_LIMIAR &&
        cliente.status !== 'inativo'
      )
  }
}
```

"Estratégico" fica de fora — `ClienteSinalizadores` em `ClienteTab.tsx` nunca recebeu `clienteEstrategico`, o badge não existe nesta aba hoje (ver spec).

- [ ] **Step 2: Verificar tipos**

```bash
npx tsc -b --noEmit
```

- [ ] **Step 3: Busca — nome/razão social e CNPJ, não cidade**

Em `src/pages/performance/ClienteTab.tsx`, acrescente perto do topo do arquivo (fora do componente):

```ts
function normalizarBusca(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

function normalizarCnpj(s: string): string {
  return s.replace(/\D/g, '')
}

function clienteBateBusca(cliente: ClienteDistribuidor, query: string): boolean {
  const q = normalizarBusca(query)
  if (!q) return true
  const nomeMatch = normalizarBusca(
    `${cliente.razao_social} ${cliente.nome_fantasia ?? ''}`
  ).includes(q)
  const cnpjQuery = normalizarCnpj(query)
  const cnpjMatch = cnpjQuery.length > 0 && normalizarCnpj(cliente.cnpj).includes(cnpjQuery)
  return nomeMatch || cnpjMatch
}
```

⚠️ `cnpjMatch` exige `cnpjQuery.length > 0` — sem essa guarda, uma busca só de letras normaliza para uma string de dígitos **vazia**, e `''.includes('')` é `true` para qualquer CNPJ, fazendo toda busca de texto bater em todo mundo pelo lado do CNPJ.

Adicione o import de `ClienteDistribuidor`:
```ts
import type { ClienteDistribuidor } from '@/types/distribuidor'
```

E os novos imports de `cliente-sinalizadores.ts`:
```ts
import {
  CLASSIFICACAO_FILTRO_LABELS,
  clienteTemClassificacao,
  type ClassificacaoFiltro,
} from '@/lib/cliente-sinalizadores'
```

- [ ] **Step 4: Filtro de Cidade/UF — opções derivadas de `rows`, não lista fixa**

Ainda em `ClienteTab.tsx`, depois do `useMemo` de `rows` (linha ~103 do arquivo atual) e depois de `cidadesMap` estar disponível (linha ~107), acrescente:

```ts
  const cidadeOptions = useMemo(() => {
    const set = new Set<string>()
    for (const row of rows) {
      const resolved = resolveClienteCidadeUf(row, cidadesMap.get(insightsCnpjKey(row.cnpj)))
      if (resolved.cidade === '—') continue
      const label = formatCidadeUf(resolved.cidade, resolved.estado)
      if (label) set.add(label)
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [rows, cidadesMap])
```

`resolveClienteCidadeUf`/`formatCidadeUf`/`insightsCnpjKey` já estão importados neste arquivo — não duplique o import.

- [ ] **Step 5: Estado local dos três filtros + o `useMemo` que aplica todos**

Depois da declaração de `const [selectedClienteId, ...]` no topo do componente:

```ts
  const [busca, setBusca] = useState('')
  const [classificacaoFiltro, setClassificacaoFiltro] = useState<
    ClassificacaoFiltro | 'todos'
  >('todos')
  const [cidadeFiltro, setCidadeFiltro] = useState<string | undefined>(undefined)
```

Depois de `cidadeOptions` (Step 4), um novo `useMemo` que estreita `rows`:

```ts
  const rowsFiltrados = useMemo(() => {
    return rows.filter((row) => {
      if (!clienteBateBusca(row, busca)) return false

      if (classificacaoFiltro !== 'todos') {
        const resumo = resumoMap.get(row.id)
        if (
          !clienteTemClassificacao(
            classificacaoFiltro,
            row,
            resumo,
            topIds.has(row.id)
          )
        ) {
          return false
        }
      }

      if (cidadeFiltro) {
        const resolved = resolveClienteCidadeUf(
          row,
          cidadesMap.get(insightsCnpjKey(row.cnpj))
        )
        if (formatCidadeUf(resolved.cidade, resolved.estado) !== cidadeFiltro) {
          return false
        }
      }

      return true
    })
  }, [rows, busca, classificacaoFiltro, cidadeFiltro, resumoMap, topIds, cidadesMap])
```

⚠️ `resumoMap`/`topIds`/`cidadesMap` continuam calculados a partir de `rows` (o recorte de hierarquia), **não** de `rowsFiltrados` — são o denominador de "Top comprador" e o que já é buscado em rede. Recalculá-los sobre o resultado da busca faria "Top" mudar de significado conforme o usuário digita, e refetch a cada tecla. Não toque nas linhas que os calculam.

No `useMemo` de `sortedRows` existente (linha ~140-158), troque a origem de `rows` para `rowsFiltrados`:

```ts
  const sortedRows = useMemo(() => {
    return [...rowsFiltrados].sort((a, b) => {
```

E adicione `rowsFiltrados` no lugar de `rows` no array de dependências desse `useMemo` (troque, não acrescente).

- [ ] **Step 6: UI — campo de busca e dois selects novos na `FilterBar`**

Antes do `return (`, ajuste o cálculo de colunas (linha ~170-177 do arquivo atual):

```ts
  const showGerenteFilter = gerentesForFilter.length > 0
  const showSupervisorFilter = supervisoresForFilter.length > 0
  const showVendedorFilter = vendedoresForFilter.length > 0
  const filterCount =
    [showGerenteFilter, showSupervisorFilter, showVendedorFilter].filter(Boolean)
      .length + 2 // Classificação e Cidade sempre aparecem
  const filterColumns = Math.min(Math.max(filterCount, 2), 4) as 2 | 3 | 4
```

Acima da `<FilterBar>` existente (antes de `{filterCount > 0 && (`), acrescente um campo de busca em largura cheia:

```tsx
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">
          Buscar
        </label>
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Nome, razão social ou CNPJ"
          className="h-8 w-full rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
        />
      </div>
```

Dentro da `<FilterBar>`, depois do `FilterField` de Vendedor (antes do `</FilterBar>` de fechamento, linha ~280), acrescente dois `FilterField` novos:

```tsx
          <FilterField label="Classificação">
            <Select
              value={classificacaoFiltro}
              onValueChange={(v) =>
                setClassificacaoFiltro(v as ClassificacaoFiltro | 'todos')
              }
            >
              <SelectTrigger className="h-8 w-full text-sm">
                <SelectValue placeholder="Todos">
                  {classificacaoFiltro === 'todos'
                    ? 'Todos'
                    : CLASSIFICACAO_FILTRO_LABELS[classificacaoFiltro]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {(Object.keys(CLASSIFICACAO_FILTRO_LABELS) as ClassificacaoFiltro[]).map(
                  (key) => (
                    <SelectItem key={key} value={key}>
                      {CLASSIFICACAO_FILTRO_LABELS[key]}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </FilterField>
          <FilterField label="Cidade / UF">
            <Select
              value={cidadeFiltro ?? 'todos'}
              onValueChange={(v) =>
                setCidadeFiltro(v === 'todos' ? undefined : v)
              }
            >
              <SelectTrigger className="h-8 w-full text-sm">
                <SelectValue placeholder="Todos">
                  {cidadeFiltro ?? 'Todos'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {cidadeOptions.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>
```

Como `Classificação`/`Cidade` sempre existem, troque a condição `{filterCount > 0 && (` por renderização incondicional da `<FilterBar>` — ela nunca mais fica vazia.

Por fim, troque `rows.length === 0` (linha ~321, condição de "nenhum cliente encontrado") e o `.map` de renderização (linha ~331) para usarem `rowsFiltrados`/`sortedRows` em vez de `rows` cru, e mantenha `sortedRows` como a fonte que a Task 4 vai paginar.

- [ ] **Step 7: Verificar tipos**

```bash
npx tsc -b --noEmit
```

Esperado: sem saída.

- [ ] **Step 8: Provar o filtro de busca contra CNPJ real, sem browser**

Use o MCP Supabase para pegar um CNPJ real do distribuidor Paraty:

```sql
select cnpj, razao_social from alwayson_clientes_distribuidor
where distribuidor_id = (
  select id from alwayson_distribuidores where nome ilike '%paraty%'
)
limit 1;
```

Escreva um script descartável em `/private/tmp/claude-501/-Users-mauro-personalprojects-alwayson-distribuidores/1bfd3dba-5cfc-4caf-9197-8719e09b918c/scratchpad/` (copie a lógica de `normalizarBusca`/`normalizarCnpj`/`clienteBateBusca` para `.mjs` puro, sem tipos) e confirme:
1. Buscar pelo CNPJ **formatado** (com pontuação) encontra o cliente.
2. Buscar por um pedaço do nome (em minúsculas, sem acento) encontra o cliente.
3. Buscar por uma palavra que não aparece nem no nome nem no CNPJ não encontra nada.
4. Buscar só por texto (sem dígito nenhum) **não** bate com todo mundo pelo lado do CNPJ — é o bug que a guarda do Step 3 evita.

Apague o script depois. Nunca o commite.

- [ ] **Step 9: Commit**

```bash
git add src/lib/cliente-sinalizadores.ts src/pages/performance/ClienteTab.tsx
git commit -m "feat(cliente): busca por nome/CNPJ + filtros de classificação e cidade

Busca não cobre cidade/UF de propósito — o dropdown dedicado já cobre, sem
duplicar o mesmo filtro em dois lugares. Guarda contra cnpjQuery vazio: sem
ela, toda busca de texto bateria em qualquer CNPJ pelo lado errado.

clienteTemClassificacao reaproveita a mesma condição que já decide os badges
(buildClienteSinalizadores) — filtro e badge nunca divergem.

resumoMap/topIds/cidadesMap continuam calculados sobre o recorte de
hierarquia, não sobre o resultado da busca — 'Top comprador' não muda de
significado conforme o usuário digita.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Paginação em Cliente

**Files:**
- Modify: `src/pages/performance/ClienteTab.tsx`

**Interfaces:**
- Consumes: `usePagination` (`src/hooks/usePagination.ts`), `PaginationBar` (`src/components/ui/pagination-bar.tsx`).

⚠️ **Esta é a task que mais precisa respeitar a restrição global de ordenar-antes-de-paginar.** `usePagination` recebe `sortedRows` (já ordenado pela Task 3/mecanismo existente) como `items` — nunca `rowsFiltrados` diretamente. Paginação é a **última** etapa do pipeline, só para decidir o que renderizar.

- [ ] **Step 1: Ligar `usePagination`**

Import:
```ts
import { usePagination } from '@/hooks/usePagination'
import { PaginationBar } from '@/components/ui/pagination-bar'
```

Depois do `useMemo` de `sortedRows` (que a Task 3 já apontou para `rowsFiltrados`):

```ts
  const { paginated, page, pageSize, setPage, setPageSize, total } = usePagination({
    items: sortedRows,
    resetKey: `${busca}|${classificacaoFiltro}|${cidadeFiltro ?? ''}|${gerenteId ?? ''}|${supervisorId ?? ''}|${vendedorId ?? ''}`,
  })
```

`resetKey` cobre busca + os 4 filtros (hierarquia + classificação + cidade) — **não** inclui `sortField`/`sortDir`. Reordenar o mesmo conjunto e continuar na página 3 é coerente; mudar o conjunto e continuar na página 3 não seria.

- [ ] **Step 2: Renderizar `paginated`, não `sortedRows`, e a barra de paginação**

No `.map()` do corpo da tabela, troque `sortedRows.map(...)` por `paginated.map(...)`. A condição de "nenhum cliente encontrado" continua checando `sortedRows.length === 0` (ou `total === 0`, equivalente) — **não** `paginated.length === 0`, que seria `true` numa página vazia por estar além do fim mesmo com resultados existindo.

Depois do `</Table>`, dentro do mesmo `<Card>`:

```tsx
        <PaginationBar
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
```

- [ ] **Step 3: Verificar tipos**

```bash
npx tsc -b --noEmit
```

- [ ] **Step 4: Provar que ordenar continua olhando os 410, não os 25 da página**

```sql
select razao_social, faturamento
from (
  select c.razao_social,
         sum(f.valor_total) filter (
           where f.data_emissao between '2026-02-01' and '2026-07-31'
         ) as faturamento
  from alwayson_clientes_distribuidor c
  left join alwayson_faturamento f on f.cliente_id = c.id
  where c.distribuidor_id = (select id from alwayson_distribuidores where nome ilike '%paraty%')
  group by c.razao_social
) t
order by faturamento desc nulls last
limit 3;
```

Ponha os 3 nomes no report. Depois de ordenar por Faturamento desc na aba (mentalmente, seguindo o código: `sortField='faturamento_mes'`, `sortDir='desc'`), a página 1 tem que trazer exatamente esses 3 primeiros — não os 3 maiores **dentre os primeiros 25 clientes carregados antes de ordenar**. Se o pipeline tivesse paginado antes de ordenar, esse teste falharia silenciosamente sempre que os maiores estivessem fora da primeira leva bruta.

- [ ] **Step 5: Commit**

```bash
git add src/pages/performance/ClienteTab.tsx
git commit -m "feat(cliente): paginação client-side, 25 por página

usePagination recebe sortedRows — nunca rowsFiltrados direto — porque ordenar
tem de continuar valendo sobre os 410 clientes, não só a página renderizada.
resetKey cobre busca + filtros, não ordenação: reordenar o mesmo conjunto na
página 3 é coerente, mudar o conjunto não seria.

Efeito colateral desejado: cada linha dispara sua própria consulta via
InsightsBadge. Paginar corta de até 410 chamadas simultâneas para ~25.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Densidade de linha em Cliente

**Files:**
- Modify: `src/pages/performance/ClienteTab.tsx`

Só padding — nenhuma coluna some, nenhum dado muda. `TableCell` default é `py-2.5 px-3` (`src/components/ui/table.tsx`), compartilhado pelo app inteiro — **não mexer nesse arquivo**. O override é local, via `className` por instância, que o `cn()`/`twMerge` deste repo já resolve corretamente por cima do default.

- [ ] **Step 1: Reduzir o padding vertical de cada `<TableCell>` do corpo**

Em cada uma das 7 células de `sortedRows`/`paginated.map(...)` (Nome, CNPJ, Cidade/UF, Faturamento, `<ColunaEvolucao>`, Última Compra, Status), acrescente `py-1.5` ao `className` já existente. Exemplo na célula de Nome:

```tsx
                  <TableCell className="max-w-[min(100%,18rem)] py-1.5 text-xs font-medium">
```

Para `<ColunaEvolucao>`, que não é um `<TableCell>` cru mas um componente que renderiza um por dentro (`src/pages/performance/ColunaEvolucao.tsx`) — **não** mude esse componente compartilhado (as outras 4 abas também o usam, com densidade normal). Aceite a altura default dessa célula específica nesta aba; é uma inconsistência menor e aceitável, não vale tocar num componente usado em 5 lugares por causa de uma aba.

Nas linhas de loading/skeleton (`Array.from({ length: 5 })`) e na linha de "Nenhum cliente encontrado", aplique o mesmo `py-1.5` para a altura não pular ao carregar.

- [ ] **Step 2: Verificar tipos**

```bash
npx tsc -b --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/performance/ClienteTab.tsx
git commit -m "style(cliente): linhas mais compactas — py-1.5 no lugar do py-2.5 default

Override por instância via className, nunca no table.tsx compartilhado — as
outras 4 abas continuam com a altura default.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Verificação final do plano

- [ ] Critério do spec de gráfico: em Gerência (4 gerentes), "Outros" nunca aparece (SQL da Task 2, Step 5).
- [ ] Critério do spec de gráfico: clicar numa linha ou legenda (não Outros) navega igual ao clique da linha da tabela.
- [ ] Critério do spec de gráfico: Vendas mostra só o filtro Supervisor.
- [ ] Critério do spec de Cliente: buscar por CNPJ formatado ou sem formatação encontra o cliente, mesmo fora da página 1.
- [ ] Critério do spec de Cliente: ordenar por Faturamento reordena os 410 clientes, não só a página atual (Task 4, Step 4).
- [ ] Critério do spec de Cliente: mudar página não altera busca/filtro; mudar busca/filtro volta para a página 1.
- [ ] Nenhum UUID visível em nenhum select novo.

## Fora de escopo (herdado dos specs)

- Gráfico em Cliente.
- Badge "Estratégico" no filtro de Classificação (exigiria wire-ar `useClientesEstrategicos`, não pedido).
- Faixa de faturamento como filtro.
- Corrigir cobertura de geocodificação de cidade.
- Marcador de meta no gráfico por nível.
