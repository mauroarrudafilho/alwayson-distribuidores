import { useState } from 'react'
import { formatAnoMesLabel } from '@/lib/insights-sinalizadores'
import { formatMetricaValor, type MetricaAnalise } from '@/lib/metrica-analise'

interface Props {
  data: { month: string; total: number }[]
  /**
   * Meses em destaque (YoY / mês de análise).
   * Só Performance deve passar um Set; Insights/histórico pleno omite ou passa vazio.
   */
  highlightMonths?: Set<string>
  metrica?: MetricaAnalise
  /** Rótulo da unidade quando metrica = unidade (ex.: UN, CX). */
  unidadeLabel?: string
  /** Título curto da série (ex.: "Movimentação histórica"). */
  seriesLabel?: string
  /** Altura da faixa de barras (abertura território usa um pouco mais). */
  barHeightClass?: string
}

/** Sparkline de toda a vida útil; detalhe YoY só quando há highlightMonths. */
export function InsightsHistoricoChart({
  data,
  highlightMonths,
  metrica = 'faturamento',
  unidadeLabel,
  seriesLabel = 'Movimentação histórica',
  barHeightClass = 'h-10',
}: Props) {
  const [hovered, setHovered] = useState<{ month: string; total: number } | null>(null)

  const formatVal = (n: number) => formatMetricaValor(n, metrica, unidadeLabel)

  if (data.length === 0) {
    return (
      <p className="py-3 text-center text-sm text-muted-foreground">
        Sem histórico mensal
      </p>
    )
  }

  const highlights = highlightMonths ?? new Set<string>()
  const showDetail = highlights.size > 0
  const maxValue = Math.max(...data.map((d) => d.total), 1)

  const detailList = showDetail
    ? data
        .filter((d) => highlights.has(d.month))
        .sort((a, b) => a.month.localeCompare(b.month))
    : []

  return (
    <div className="space-y-3">
      <div className="relative rounded-md border bg-muted/15 px-2 py-2">
        <p className="mb-1.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
          {seriesLabel} · {data.length} meses
        </p>
        {hovered && (
          <div className="pointer-events-none absolute left-1/2 top-1 z-10 -translate-x-1/2 rounded-md bg-foreground px-2 py-1 text-[10px] text-background shadow-md">
            <span className="font-medium">{formatAnoMesLabel(hovered.month)}</span>
            {' · '}
            <span className="tabular-nums">{formatVal(hovered.total)}</span>
          </div>
        )}
        <div className={`flex items-end gap-px ${barHeightClass}`}>
          {data.map((d) => {
            const h = Math.max(4, (d.total / maxValue) * 100)
            const isHi = highlights.has(d.month)
            const isHovered = hovered?.month === d.month
            return (
              <div
                key={d.month}
                role="presentation"
                onMouseEnter={() => setHovered({ month: d.month, total: d.total })}
                onMouseLeave={() => setHovered(null)}
                className={`min-w-0 flex-1 cursor-crosshair rounded-t transition-colors ${
                  isHi
                    ? isHovered
                      ? 'bg-amber-600'
                      : 'bg-amber-500'
                    : isHovered
                      ? 'bg-primary/80'
                      : 'bg-primary/45'
                }`}
                style={{ height: `${h}%` }}
              />
            )
          })}
        </div>
      </div>

      {detailList.length > 0 && (
        <div className="max-h-40 space-y-1 overflow-y-auto pr-1">
          {detailList.map((d) => {
            const pct = (d.total / maxValue) * 100
            const isHi = highlights.has(d.month)
            return (
              <div
                key={d.month}
                className={`flex items-center gap-2 rounded px-1 py-0.5 ${
                  isHi ? 'bg-amber-500/10 ring-1 ring-amber-500/30' : ''
                }`}
                onMouseEnter={() => setHovered({ month: d.month, total: d.total })}
                onMouseLeave={() => setHovered(null)}
              >
                <span
                  className={`w-12 shrink-0 text-right tabular-nums ${
                    isHi
                      ? 'text-xs font-semibold text-amber-700 dark:text-amber-400'
                      : 'text-[10px] text-muted-foreground'
                  }`}
                >
                  {formatAnoMesLabel(d.month)}
                </span>
                <div className="h-3.5 flex-1 overflow-hidden rounded bg-muted/50">
                  <div
                    className={`h-full rounded ${isHi ? 'bg-amber-500' : 'bg-primary/75'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span
                  className={`w-16 shrink-0 text-right tabular-nums ${
                    isHi ? 'text-xs font-semibold' : 'text-[10px] font-medium'
                  }`}
                >
                  {formatVal(d.total)}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
