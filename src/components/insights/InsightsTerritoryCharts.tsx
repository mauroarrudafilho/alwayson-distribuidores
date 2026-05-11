import { useMemo } from 'react'
import { Info } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts'
import type { InsightsCidadeRow, InsightsMesGlobalRow } from '@/types/insights'
import { formatCurrency } from '@/lib/format'
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  InsightsChartCard,
  InsightsCallout,
  formatCurrencyCompact,
  formatPercent,
  formatInt,
  CHART_AXIS_TICK,
  CHART_GRID_STROKE,
  INSIGHTS_CHART_COLORS,
  coerceTooltipNumber,
} from '@/components/insights/charts'
import { buildYoySeries } from '@/lib/insights-yoy'

function cidadeLabel(c: InsightsCidadeRow, maxLen = 18) {
  const s = `${c.cidade} / ${c.estado}`
  return s.length > maxLen ? `${s.slice(0, maxLen - 1)}…` : s
}

type Props = {
  cidades: InsightsCidadeRow[]
  faturamentoFiltrado: number
  /** Série mensal global (view 027); vazio se a view ainda não existir no projeto. */
  mesGlobal?: InsightsMesGlobalRow[]
}

export function InsightsTerritoryCharts({ cidades, faturamentoFiltrado, mesGlobal = [] }: Props) {
  const mesGlobalYoy = useMemo(
    () => buildYoySeries(mesGlobal, 'faturamento_total'),
    [mesGlobal]
  )
  const topCidades = useMemo(() => {
    const sorted = [...cidades].sort((a, b) => b.faturamento_total - a.faturamento_total)
    return sorted.slice(0, 20).map((c) => ({
      name: cidadeLabel(c, 28),
      full: `${c.cidade} — ${c.estado}`,
      fat: c.faturamento_total,
      clientes: c.total_clientes,
      nfs: c.total_nfs,
    }))
  }, [cidades])

  const byUf = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of cidades) {
      m.set(c.estado, (m.get(c.estado) ?? 0) + c.faturamento_total)
    }
    return [...m.entries()]
      .map(([uf, fat]) => ({ uf, fat, name: uf }))
      .sort((a, b) => b.fat - a.fat)
  }, [cidades])

  const pieUf = useMemo(
    () =>
      byUf.map((x) => ({
        name: x.uf,
        value: x.fat,
      })),
    [byUf]
  )

  const scatter = useMemo(
    () =>
      cidades.map((c) => ({
        name: cidadeLabel(c, 16),
        full: `${c.cidade} — ${c.estado}`,
        clientes: c.total_clientes,
        fat: c.faturamento_total,
        nfs: c.total_nfs,
      })),
    [cidades]
  )

  const callouts = useMemo(() => {
    const sorted = [...cidades].sort((a, b) => b.faturamento_total - a.faturamento_total)
    const total = faturamentoFiltrado > 0 ? faturamentoFiltrado : 1
    const sumN = (n: number) =>
      sorted.slice(0, n).reduce((s, c) => s + c.faturamento_total, 0)
    const leader = byUf[0]
    const second = byUf[1]
    const gap =
      leader && second && second.fat > 0
        ? ((leader.fat - second.fat) / second.fat) * 100
        : null
    return {
      top3Pct: (sumN(3) / total) * 100,
      top5Pct: (sumN(5) / total) * 100,
      top10Pct: (sumN(10) / total) * 100,
      top20Pct: (sumN(20) / total) * 100,
      leaderUf: leader?.uf,
      leaderShare: leader ? (leader.fat / total) * 100 : 0,
      gapPct: gap,
    }
  }, [cidades, faturamentoFiltrado, byUf])

  if (cidades.length === 0) {
    return (
      <p className="text-sm text-muted-foreground mb-4">Sem cidades para exibir nos gráficos.</p>
    )
  }

  return (
    <div className="space-y-4 mb-6">
      {mesGlobal.length > 0 ? (
        <InsightsChartCard
          title="Sell-out mensal · ano-sobre-ano"
          description="Faturamento agregado (todas as NFs Insights) · Jan–Dez · uma linha por ano"
          height={260}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={mesGlobalYoy.data} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid stroke={CHART_GRID_STROKE} strokeDasharray="3 3" />
              <XAxis dataKey="mes" tick={CHART_AXIS_TICK} interval={0} />
              <YAxis
                tick={CHART_AXIS_TICK}
                tickFormatter={(v: number) => formatCurrencyCompact(v)}
              />
              <Tooltip
                formatter={((value: unknown) =>
                  formatCurrency(coerceTooltipNumber(value))
                ) as never}
                contentStyle={{
                  borderRadius: 8,
                  border: '1px solid var(--color-border)',
                  fontSize: 12,
                }}
              />
              <Legend
                iconType="circle"
                wrapperStyle={{ fontSize: 11, paddingTop: 4 }}
                formatter={(value) => (
                  <span className="text-xs text-muted-foreground">{value}</span>
                )}
              />
              {mesGlobalYoy.years.map((year, idx) => (
                <Line
                  key={year}
                  type="monotone"
                  dataKey={String(year)}
                  stroke={INSIGHTS_CHART_COLORS[idx % INSIGHTS_CHART_COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  name={String(year)}
                  connectNulls={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </InsightsChartCard>
      ) : null}

      <InsightsCallout>
        <p>
          As <strong>top 3</strong> cidades concentram{' '}
          <strong>{formatPercent(callouts.top3Pct)}</strong> do faturamento do filtro; as{' '}
          <strong>top 5</strong>, <strong>{formatPercent(callouts.top5Pct)}</strong>.
        </p>
        {callouts.leaderUf ? (
          <p>
            <strong>{callouts.leaderUf}</strong> lidera com{' '}
            <strong>{formatPercent(callouts.leaderShare)}</strong> do total
            {callouts.gapPct != null && byUf.length >= 2 ? (
              <>
                {' '}
                — <strong>{formatPercent(callouts.gapPct)}</strong> acima de{' '}
                <strong>{byUf[1].uf}</strong> em faturamento
              </>
            ) : null}
            .
          </p>
        ) : null}
      </InsightsCallout>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <InsightsChartCard
          title="Top 20 cidades por faturamento"
          description={`Da lista filtrada — ${cidades.length.toLocaleString('pt-BR')} cidades`}
          headerAction={
            <UITooltip>
              <TooltipTrigger
                type="button"
                aria-label="Detalhes da concentração de cidades"
                className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/70 hover:bg-muted/40 hover:text-foreground transition-colors"
              >
                <Info className="h-3.5 w-3.5" />
              </TooltipTrigger>
              <TooltipContent className="max-w-[320px] p-3 text-left">
                <div className="space-y-1.5 text-xs leading-relaxed">
                  <p>
                    As <strong>3 maiores</strong> cidades concentram{' '}
                    <strong>{formatPercent(callouts.top3Pct)}</strong>; as{' '}
                    <strong>10 maiores</strong>,{' '}
                    <strong>{formatPercent(callouts.top10Pct)}</strong>; as{' '}
                    <strong>20 maiores</strong>,{' '}
                    <strong>{formatPercent(callouts.top20Pct)}</strong>.
                  </p>
                  {callouts.leaderUf && (
                    <p>
                      <strong>{callouts.leaderUf}</strong> lidera entre estados com{' '}
                      <strong>{formatPercent(callouts.leaderShare)}</strong> do total.
                    </p>
                  )}
                </div>
              </TooltipContent>
            </UITooltip>
          }
          height={520}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={topCidades}
              layout="vertical"
              margin={{ left: 4, right: 16, top: 4, bottom: 4 }}
            >
              <CartesianGrid stroke={CHART_GRID_STROKE} strokeDasharray="3 3" horizontal={false} />
              <XAxis
                type="number"
                tick={CHART_AXIS_TICK}
                tickFormatter={(v: number) => formatCurrencyCompact(v)}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={200}
                tick={CHART_AXIS_TICK}
                interval={0}
              />
              <Tooltip
                formatter={((value: unknown) =>
                  formatCurrency(coerceTooltipNumber(value))
                ) as never}
                labelFormatter={(_, payload) =>
                  payload?.[0]?.payload?.full ?? (payload?.[0]?.payload?.name as string)
                }
                contentStyle={{
                  borderRadius: 8,
                  border: '1px solid var(--color-border)',
                  fontSize: 12,
                }}
              />
              <Bar dataKey="fat" fill="var(--color-primary)" radius={[0, 4, 4, 0]} name="Faturamento" />
            </BarChart>
          </ResponsiveContainer>
        </InsightsChartCard>

        <InsightsChartCard title="Faturamento por estado" description="Composição do filtro atual">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart margin={{ top: 4, bottom: 4, left: 4, right: 4 }}>
              <Pie
                data={pieUf}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={56}
                outerRadius={92}
                paddingAngle={2}
              >
                {pieUf.map((entry, index) => (
                  <Cell
                    key={entry.name}
                    fill={INSIGHTS_CHART_COLORS[index % INSIGHTS_CHART_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={((value: unknown) =>
                  formatCurrency(coerceTooltipNumber(value))
                ) as never}
                contentStyle={{
                  borderRadius: 8,
                  border: '1px solid var(--color-border)',
                  fontSize: 12,
                }}
              />
              <Legend
                formatter={(value) => <span className="text-xs text-muted-foreground">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </InsightsChartCard>

        <InsightsChartCard
          title="Clientes × faturamento"
          description="Cada ponto é uma cidade; tamanho ∝ notas fiscais"
        >
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 8, right: 12, bottom: 8, left: 4 }}>
              <CartesianGrid stroke={CHART_GRID_STROKE} strokeDasharray="3 3" />
              <XAxis
                type="number"
                dataKey="clientes"
                name="Clientes"
                tick={CHART_AXIS_TICK}
                label={{ value: 'Clientes', position: 'bottom', fill: 'var(--color-muted-foreground)', fontSize: 11 }}
              />
              <YAxis
                type="number"
                dataKey="fat"
                name="Faturamento"
                tick={CHART_AXIS_TICK}
                tickFormatter={(v: number) => formatCurrencyCompact(v)}
              />
              <ZAxis type="number" dataKey="nfs" range={[40, 400]} />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                formatter={((value: unknown, name: unknown) => {
                  const v = coerceTooltipNumber(value)
                  const n = String(name).toLowerCase()
                  if (n.includes('clientes')) return formatInt(v)
                  if (n.includes('fat')) return formatCurrency(v)
                  if (n.includes('nfs')) return formatInt(v)
                  return formatCurrency(v)
                }) as never}
                labelFormatter={(_, payload) =>
                  payload?.[0]?.payload?.full ?? (payload?.[0]?.payload?.name as string)
                }
                contentStyle={{
                  borderRadius: 8,
                  border: '1px solid var(--color-border)',
                  fontSize: 12,
                }}
              />
              <Scatter name="Cidades" data={scatter} fill="var(--color-primary)" />
            </ScatterChart>
          </ResponsiveContainer>
        </InsightsChartCard>
      </div>
    </div>
  )
}
