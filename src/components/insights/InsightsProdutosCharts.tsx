import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from 'recharts'
import type { InsightsProdutoDetalhe, InsightsProdutoRow } from '@/types/insights'
import { formatCurrency } from '@/lib/format'
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

function skuNome(p: InsightsProdutoRow, maxLen = 28) {
  const d = p.descricao?.trim()
  const s = d && d !== p.sku ? `${p.sku} · ${d}` : p.sku
  return s.length > maxLen ? `${s.slice(0, maxLen - 1)}…` : s
}

function countSkusForCumulativePct(
  produtosSorted: InsightsProdutoRow[],
  fatTotal: number,
  thresholdPct: number
): number {
  if (fatTotal <= 0) return 0
  let cum = 0
  let n = 0
  const target = (thresholdPct / 100) * fatTotal
  for (const p of produtosSorted) {
    cum += p.faturamento_total
    n += 1
    if (cum >= target) break
  }
  return n
}

type Props = {
  produtosFiltrados: InsightsProdutoRow[]
  fatTotalFiltrado: number
}

export function InsightsProdutosCharts({ produtosFiltrados, fatTotalFiltrado }: Props) {
  const byCategoria = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of produtosFiltrados) {
      const k = p.categoria || '—'
      m.set(k, (m.get(k) ?? 0) + p.faturamento_total)
    }
    return [...m.entries()]
      .map(([name, fat]) => ({ name, fat, value: fat }))
      .sort((a, b) => b.fat - a.fat)
  }, [produtosFiltrados])

  const pieCat = useMemo(
    () =>
      byCategoria.map((x) => ({
        name: x.name,
        value: x.fat,
      })),
    [byCategoria]
  )

  const topSkus = useMemo(() => {
    return [...produtosFiltrados]
      .sort((a, b) => b.faturamento_total - a.faturamento_total)
      .slice(0, 15)
      .map((p) => ({
        name: skuNome(p, 36),
        full: `${p.sku} — ${p.descricao}`,
        fat: p.faturamento_total,
      }))
  }, [produtosFiltrados])

  const byMarca = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of produtosFiltrados) {
      const k = p.marca && p.marca !== '—' ? p.marca : 'Sem marca'
      m.set(k, (m.get(k) ?? 0) + p.faturamento_total)
    }
    return [...m.entries()]
      .map(([marca, fat]) => ({ marca, name: marca, fat }))
      .sort((a, b) => b.fat - a.fat)
      .slice(0, 12)
  }, [produtosFiltrados])

  const callouts = useMemo(() => {
    const denom = fatTotalFiltrado > 0 ? fatTotalFiltrado : 1
    const top3 = byCategoria.slice(0, 3).reduce((s, x) => s + x.fat, 0)
    const sorted = [...produtosFiltrados].sort((a, b) => b.faturamento_total - a.faturamento_total)
    const n80 = countSkusForCumulativePct(sorted, fatTotalFiltrado, 80)
    return {
      top3Pct: (top3 / denom) * 100,
      n80,
      nProd: produtosFiltrados.length,
    }
  }, [byCategoria, produtosFiltrados, fatTotalFiltrado])

  if (produtosFiltrados.length === 0) {
    return (
      <p className="text-sm text-muted-foreground mb-4">Sem produtos para exibir nos gráficos.</p>
    )
  }

  return (
    <div className="space-y-4 mb-6">
      <InsightsCallout>
        <p>
          As <strong>3 maiores categorias</strong> somam{' '}
          <strong>{formatPercent(callouts.top3Pct)}</strong> do faturamento filtrado.
        </p>
        <p>
          Apenas <strong>{formatInt(callouts.n80)}</strong> SKU(s) (de {formatInt(callouts.nProd)}) acumulam{' '}
          <strong>80%</strong> desse faturamento.
        </p>
      </InsightsCallout>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <InsightsChartCard title="Mix por categoria" description="Faturamento total no filtro">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart margin={{ top: 8, bottom: 8 }}>
              <Pie
                data={pieCat}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={52}
                outerRadius={88}
                paddingAngle={2}
              >
                {pieCat.map((e, i) => (
                  <Cell key={e.name} fill={INSIGHTS_CHART_COLORS[i % INSIGHTS_CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={((v: unknown) => formatCurrency(coerceTooltipNumber(v))) as never} />
              <Legend
                formatter={(v) => <span className="text-[11px] text-muted-foreground">{v}</span>}
                wrapperStyle={{ fontSize: 11 }}
              />
            </PieChart>
          </ResponsiveContainer>
        </InsightsChartCard>

        <InsightsChartCard title="Top SKUs — faturamento" description="Até 15 maiores">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart layout="vertical" data={topSkus} margin={{ left: 4, right: 12, top: 8 }}>
              <CartesianGrid stroke={CHART_GRID_STROKE} strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={CHART_AXIS_TICK} tickFormatter={(v) => formatCurrencyCompact(v)} />
              <YAxis type="category" dataKey="name" width={148} tick={CHART_AXIS_TICK} interval={0} />
              <Tooltip
                formatter={((v: unknown) => formatCurrency(coerceTooltipNumber(v))) as never}
                labelFormatter={(_, p) => p?.[0]?.payload?.full ?? ''}
                contentStyle={{
                  borderRadius: 8,
                  border: '1px solid var(--color-border)',
                  fontSize: 12,
                }}
              />
              <Bar dataKey="fat" fill="var(--color-primary)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </InsightsChartCard>

        <InsightsChartCard title="Marcas — faturamento" description="Até 12 maiores · “Sem marca” agrupa linhas sem marca">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byMarca} margin={{ left: 4, right: 8, top: 8, bottom: 64 }}>
              <CartesianGrid stroke={CHART_GRID_STROKE} strokeDasharray="3 3" />
              <XAxis dataKey="marca" tick={CHART_AXIS_TICK} interval={0} angle={-28} textAnchor="end" height={72} />
              <YAxis tick={CHART_AXIS_TICK} tickFormatter={(v) => formatCurrencyCompact(v)} />
              <Tooltip formatter={((v: unknown) => formatCurrency(coerceTooltipNumber(v))) as never} />
              <Bar dataKey="fat" radius={[4, 4, 0, 0]}>
                {byMarca.map((_, i) => (
                  <Cell key={i} fill={INSIGHTS_CHART_COLORS[i % INSIGHTS_CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </InsightsChartCard>
      </div>
    </div>
  )
}

/** Mini barras para o drill-down do SKU no painel Produtos */
export function InsightsProdutoDrillCharts({ detalhe }: { detalhe: InsightsProdutoDetalhe }) {
  const topCli = [...detalhe.topClientes].sort((a, b) => b.faturamento_total - a.faturamento_total).slice(0, 8)
  const topCit = [...detalhe.topCidades].sort((a, b) => b.faturamento_total - a.faturamento_total).slice(0, 8)

  const dataCli = topCli.map((c) => ({
    name:
      (c.nome_cliente ?? '—').length > 20
        ? `${(c.nome_cliente ?? '—').slice(0, 19)}…`
        : (c.nome_cliente ?? '—'),
    full: `${c.nome_cliente} · ${c.cidade}/${c.estado}`,
    fat: c.faturamento_total,
  }))

  const dataCit = topCit.map((c) => ({
    name: `${c.cidade}/${c.estado}`.length > 22 ? `${`${c.cidade}/${c.estado}`.slice(0, 21)}…` : `${c.cidade}/${c.estado}`,
    full: `${c.cidade} · ${c.estado}`,
    fat: c.faturamento_total,
  }))

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <InsightsChartCard title="Top clientes (SKU)" height={220}>
        {dataCli.length === 0 ? (
          <p className="text-xs text-muted-foreground flex items-center justify-center h-full">Sem dados.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart layout="vertical" data={dataCli} margin={{ left: 2, right: 10, top: 4 }}>
              <CartesianGrid stroke={CHART_GRID_STROKE} strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={CHART_AXIS_TICK} tickFormatter={(v) => formatCurrencyCompact(v)} hide />
              <YAxis type="category" dataKey="name" width={120} tick={{ ...CHART_AXIS_TICK, fontSize: 10 }} />
              <Tooltip
                formatter={((v: unknown) => formatCurrency(coerceTooltipNumber(v))) as never}
                labelFormatter={(_, p) => String(p?.[0]?.payload?.full ?? '')}
                contentStyle={{ borderRadius: 8, border: '1px solid var(--color-border)', fontSize: 11 }}
              />
              <Bar dataKey="fat" fill="var(--color-primary)" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </InsightsChartCard>

      <InsightsChartCard title="Top cidades (SKU)" height={220}>
        {dataCit.length === 0 ? (
          <p className="text-xs text-muted-foreground flex items-center justify-center h-full">Sem dados.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart layout="vertical" data={dataCit} margin={{ left: 2, right: 10, top: 4 }}>
              <CartesianGrid stroke={CHART_GRID_STROKE} strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={CHART_AXIS_TICK} tickFormatter={(v) => formatCurrencyCompact(v)} hide />
              <YAxis type="category" dataKey="name" width={120} tick={{ ...CHART_AXIS_TICK, fontSize: 10 }} />
              <Tooltip
                formatter={((v: unknown) => formatCurrency(coerceTooltipNumber(v))) as never}
                labelFormatter={(_, p) => String(p?.[0]?.payload?.full ?? '')}
                contentStyle={{ borderRadius: 8, border: '1px solid var(--color-border)', fontSize: 11 }}
              />
              <Bar dataKey="fat" fill={INSIGHTS_CHART_COLORS[1]} radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </InsightsChartCard>
    </div>
  )
}
