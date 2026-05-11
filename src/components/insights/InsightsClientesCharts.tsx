import { useMemo } from 'react'
import { Info } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { InsightsTopCliente } from '@/types/insights'
import { formatCurrency } from '@/lib/format'
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  InsightsChartCard,
  formatCurrencyCompact,
  formatPercent,
  formatInt,
  CHART_AXIS_TICK,
  CHART_GRID_STROKE,
  INSIGHTS_CHART_COLORS,
  coerceTooltipNumber,
} from '@/components/insights/charts'

function clienteLabel(c: InsightsTopCliente, maxLen = 28) {
  const n = (c.nome_cliente && c.nome_cliente !== '—' ? c.nome_cliente : c.razao_social) ?? '—'
  return n.length > maxLen ? `${n.slice(0, maxLen - 1)}…` : n
}

function quarterFromIso(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim())
  if (!m) return '—'
  const y = Number(m[1])
  const mon = Number(m[2])
  const q = Math.floor((mon - 1) / 3) + 1
  return `${y}-Q${q}`
}

const HIST_BUCKETS: { key: string; min: number; max: number | null }[] = [
  { key: 'Até R$ 5 mil', min: 0, max: 5000 },
  { key: 'R$ 5–25 mil', min: 5000, max: 25_000 },
  { key: 'R$ 25–100 mil', min: 25_000, max: 100_000 },
  { key: 'R$ 100–500 mil', min: 100_000, max: 500_000 },
  { key: 'Acima de R$ 500 mil', min: 500_000, max: null },
]

type Props = {
  clientes: InsightsTopCliente[]
}

export function InsightsClientesCharts({ clientes }: Props) {
  const totalFat = useMemo(
    () => clientes.reduce((s, c) => s + c.faturamento_total, 0),
    [clientes]
  )

  const top20 = useMemo(() => {
    const sorted = [...clientes].sort((a, b) => b.faturamento_total - a.faturamento_total)
    return sorted.slice(0, 20).map((c, idx) => ({
      rank: idx + 1,
      name: clienteLabel(c, 28),
      full: `${clienteLabel(c, 80)} · ${c.cnpj_cliente}`,
      fat: c.faturamento_total,
    }))
  }, [clientes])

  const byUf = useMemo(() => {
    const m = new Map<string, { ufs: number; fat: number }>()
    for (const c of clientes) {
      const uf = (c.estado ?? '—').trim() || '—'
      const prev = m.get(uf) ?? { ufs: 0, fat: 0 }
      prev.ufs += 1
      prev.fat += c.faturamento_total
      m.set(uf, prev)
    }
    return [...m.entries()]
      .map(([uf, v]) => ({ uf, name: uf, count: v.ufs, fat: v.fat }))
      .sort((a, b) => b.fat - a.fat)
  }, [clientes])

  const histogram = useMemo(() => {
    const counts = HIST_BUCKETS.map((b) => ({ name: b.key, count: 0, fat: 0 }))
    for (const c of clientes) {
      const f = c.faturamento_total
      let idx = HIST_BUCKETS.length - 1
      for (let i = 0; i < HIST_BUCKETS.length; i++) {
        const b = HIST_BUCKETS[i]
        const underMax = b.max == null || f < b.max
        const overMin = f >= b.min
        if (overMin && underMax) {
          idx = i
          break
        }
      }
      counts[idx].count += 1
      counts[idx].fat += f
    }
    return counts
  }, [clientes])

  const callouts = useMemo(() => {
    const sorted = [...clientes].sort((a, b) => b.faturamento_total - a.faturamento_total)
    const denom = totalFat > 0 ? totalFat : 1
    const sumN = (n: number) =>
      sorted.slice(0, n).reduce((s, c) => s + c.faturamento_total, 0)
    const now = new Date()
    const ms180 = 180 * 24 * 60 * 60 * 1000
    const stale = clientes.filter((c) => {
      if (!c.ultima_compra) return true
      const d = new Date(`${c.ultima_compra}T12:00:00`)
      return now.getTime() - d.getTime() > ms180
    }).length
    const top3Cat = HIST_BUCKETS.map((b, i) => ({ key: b.key, ...histogram[i] }))
      .filter((x) => x.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
    return {
      top10Pct: (sumN(10) / denom) * 100,
      top20Pct: (sumN(20) / denom) * 100,
      staleCount: stale,
      top3CatLabel: top3Cat.map((x) => x.key).join(', '),
    }
  }, [clientes, totalFat, histogram])

  const byQuarter = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of clientes) {
      if (!c.ultima_compra) continue
      const k = quarterFromIso(c.ultima_compra)
      if (k === '—') continue
      m.set(k, (m.get(k) ?? 0) + 1)
    }
    return [...m.entries()]
      .map(([q, count]) => ({ q, name: q, count }))
      .sort((a, b) => a.q.localeCompare(b.q))
  }, [clientes])

  if (clientes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground mb-4">Sem clientes para exibir nos gráficos.</p>
    )
  }

  const topInfo = (
    <UITooltip>
      <TooltipTrigger
        type="button"
        aria-label="Detalhes da lista"
        className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/70 hover:bg-muted/40 hover:text-foreground transition-colors"
      >
        <Info className="h-3.5 w-3.5" />
      </TooltipTrigger>
      <TooltipContent className="max-w-[320px] p-3 text-left">
        <div className="space-y-1.5 text-xs leading-relaxed">
          <p>
            Os <strong>10 maiores</strong> clientes respondem por{' '}
            <strong>{formatPercent(callouts.top10Pct)}</strong> do faturamento da lista
            filtrada; os <strong>20 maiores</strong>,{' '}
            <strong>{formatPercent(callouts.top20Pct)}</strong>.
          </p>
          <p>
            <strong>{formatInt(callouts.staleCount)}</strong> cliente(s) sem compra nos
            últimos <strong>180 dias</strong> (ou sem data de última compra).
          </p>
          {callouts.top3CatLabel && (
            <p className="opacity-80">
              Faixas mais povoadas: {callouts.top3CatLabel}.
            </p>
          )}
        </div>
      </TooltipContent>
    </UITooltip>
  )

  return (
    <div className="space-y-4 mb-6">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <InsightsChartCard
          title="Top 20 clientes por faturamento"
          description={`Da lista filtrada — ${clientes.length.toLocaleString('pt-BR')} clientes`}
          headerAction={topInfo}
          height={520}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={top20}
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
                formatter={((v: unknown) => formatCurrency(coerceTooltipNumber(v))) as never}
                labelFormatter={(_, p) => p?.[0]?.payload?.full ?? ''}
                contentStyle={{
                  borderRadius: 8,
                  border: '1px solid var(--color-border)',
                  fontSize: 12,
                }}
              />
              <Bar
                dataKey="fat"
                fill="var(--color-primary)"
                radius={[0, 4, 4, 0]}
                name="Faturamento"
              />
            </BarChart>
          </ResponsiveContainer>
        </InsightsChartCard>

        <InsightsChartCard title="Faturamento por estado" description="Barras por UF; passe o mouse para ver quantidade de clientes">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byUf} layout="vertical" margin={{ left: 8, right: 16, top: 8 }}>
              <CartesianGrid stroke={CHART_GRID_STROKE} strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={CHART_AXIS_TICK} tickFormatter={(v) => formatCurrencyCompact(v)} />
              <YAxis type="category" dataKey="uf" width={40} tick={CHART_AXIS_TICK} />
              <Tooltip
                content={({ payload }) => {
                  const p = payload?.[0]?.payload as { uf?: string; fat?: number; count?: number } | undefined
                  if (!p) return null
                  return (
                    <div className="rounded-lg border border-border bg-background px-3 py-2 text-xs shadow-sm">
                      <div className="font-medium">{p.uf}</div>
                      <div className="tabular-nums">{formatCurrency(p.fat ?? 0)}</div>
                      <div className="text-muted-foreground">{formatInt(p.count ?? 0)} cliente(s)</div>
                    </div>
                  )
                }}
              />
              <Bar dataKey="fat" fill="var(--color-primary)" name="Faturamento" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </InsightsChartCard>

        <InsightsChartCard
          title="Distribuição por faixa de faturamento"
          description="Contagem de clientes na lista filtrada"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={histogram} margin={{ left: 4, right: 8, top: 8, bottom: 8 }}>
              <CartesianGrid stroke={CHART_GRID_STROKE} strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={CHART_AXIS_TICK} interval={0} angle={-18} textAnchor="end" height={64} />
              <YAxis tick={CHART_AXIS_TICK} allowDecimals={false} />
              <Tooltip
                formatter={((value: unknown, name: unknown) => {
                  const v = coerceTooltipNumber(value)
                  return String(name) === 'fat' ? formatCurrency(v) : formatInt(v)
                }) as never}
                contentStyle={{
                  borderRadius: 8,
                  border: '1px solid var(--color-border)',
                  fontSize: 12,
                }}
              />
              <Bar dataKey="count" name="Clientes" radius={[4, 4, 0, 0]}>
                {histogram.map((_, i) => (
                  <Cell key={i} fill={INSIGHTS_CHART_COLORS[i % INSIGHTS_CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </InsightsChartCard>

        <InsightsChartCard
          title="Última compra — trimestre civil"
          description="Quantos clientes tiveram última NF em cada trimestre"
        >
          {byQuarter.length === 0 ? (
            <p className="text-sm text-muted-foreground flex items-center h-full justify-center">
              Sem datas de última compra.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byQuarter} margin={{ left: 4, right: 8, top: 8, bottom: 8 }}>
                <CartesianGrid stroke={CHART_GRID_STROKE} strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={CHART_AXIS_TICK} interval={0} angle={-16} textAnchor="end" height={56} />
                <YAxis tick={CHART_AXIS_TICK} allowDecimals={false} />
                <Tooltip
                  formatter={((value: unknown) => formatInt(coerceTooltipNumber(value))) as never}
                  contentStyle={{
                    borderRadius: 8,
                    border: '1px solid var(--color-border)',
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="count" fill="var(--color-primary)" name="Clientes" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </InsightsChartCard>
      </div>
    </div>
  )
}
