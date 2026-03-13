import { cn } from '@/lib/utils'
import { Progress } from '@/components/ui/progress'

interface MetaProgressBarProps {
  label: string
  percentual: number
  meta: string | number
  realizado: string | number
}

function getColorClass(percentual: number) {
  if (percentual >= 100) return 'bg-emerald-500'
  if (percentual >= 70) return 'bg-amber-500'
  return 'bg-red-500'
}

function getTextColor(percentual: number) {
  if (percentual >= 100) return 'text-emerald-600'
  if (percentual >= 70) return 'text-amber-600'
  return 'text-red-600'
}

export function MetaProgressBar({
  label,
  percentual,
  meta,
  realizado,
}: MetaProgressBarProps) {
  const capped = Math.min(percentual, 100)

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-foreground font-medium">{label}</span>
        <span
          className={cn(
            'text-xs font-bold tabular-nums',
            getTextColor(percentual)
          )}
        >
          {percentual.toFixed(1)}%
        </span>
      </div>
      <div className="relative">
        <Progress value={capped} className="h-1.5" />
        <div
          className={cn(
            'absolute inset-0 h-1.5 rounded-full transition-all',
            getColorClass(percentual)
          )}
          style={{ width: `${capped}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>Realizado: {realizado}</span>
        <span>Meta: {meta}</span>
      </div>
    </div>
  )
}
