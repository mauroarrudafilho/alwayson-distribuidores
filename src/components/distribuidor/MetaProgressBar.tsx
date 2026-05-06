import { cn } from '@/lib/utils'

interface MetaProgressBarProps {
  label: string
  percentual: number
  meta: string | number
  realizado: string | number
}

function getColorClass(percentual: number) {
  if (percentual >= 100) return 'bg-success'
  if (percentual >= 70) return 'bg-warning'
  return 'bg-destructive'
}

function getTextColor(percentual: number) {
  if (percentual >= 100) return 'text-success'
  if (percentual >= 70) return 'text-warning'
  return 'text-destructive'
}

export function MetaProgressBar({
  label,
  percentual,
  meta,
  realizado,
}: MetaProgressBarProps) {
  const capped = Math.min(percentual, 100)

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-foreground font-medium">{label}</span>
        <span
          className={cn(
            'text-sm font-bold tabular-nums',
            getTextColor(percentual)
          )}
        >
          {percentual.toFixed(1)}%
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            getColorClass(percentual)
          )}
          style={{ width: `${capped}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Realizado: {realizado}</span>
        <span>Meta: {meta}</span>
      </div>
    </div>
  )
}
