import { formatCurrency } from '@/lib/format'

interface MonthlyBarChartProps {
  data: { month: string; total: number }[]
  /** Mostra apenas os últimos N meses (padrão: todos). */
  maxItems?: number
  compact?: boolean
}

function formatMonth(m: string) {
  const [year, month] = m.split('-')
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  return `${months[Number(month) - 1]}/${year.slice(2)}`
}

export function MonthlyBarChart({ data, maxItems, compact }: MonthlyBarChartProps) {
  const visible = maxItems ? data.slice(-maxItems) : data
  const maxValue = Math.max(...visible.map((d) => d.total), 1)

  if (visible.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        Sem dados de evolução
      </p>
    )
  }

  return (
    <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
      {visible.map((d) => {
        const pct = (d.total / maxValue) * 100
        return (
          <div key={d.month} className="flex items-center gap-2">
            <span
              className={`shrink-0 text-right tabular-nums text-muted-foreground ${
                compact ? 'w-12 text-[10px]' : 'w-16 text-xs'
              }`}
            >
              {formatMonth(d.month)}
            </span>
            <div
              className={`flex-1 overflow-hidden rounded bg-muted/50 ${
                compact ? 'h-4' : 'h-6'
              }`}
            >
              <div
                className="h-full rounded bg-primary/80 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span
              className={`shrink-0 text-right font-medium tabular-nums ${
                compact ? 'w-16 text-[10px]' : 'w-24 text-xs'
              }`}
            >
              {formatCurrency(d.total)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
