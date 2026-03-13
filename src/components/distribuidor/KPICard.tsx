import type { LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface KPICardProps {
  label: string
  value: string | number
  icon: LucideIcon
  badge?: string | number
  subtitle?: string
  variant?: 'default' | 'primary'
  trend?: { value: number; positive: boolean }
}

export function KPICard({
  label,
  value,
  icon: Icon,
  badge,
  subtitle,
  variant = 'default',
  trend,
}: KPICardProps) {
  return (
    <Card
      className={cn(
        'rounded-md border hover:border-border/80 transition-colors shadow-none',
        variant === 'primary'
          ? 'border-primary/20 bg-primary/5'
          : 'border-border/50 bg-card'
      )}
    >
      <CardContent className="p-3">
        <div className="flex items-center justify-between gap-2 text-muted-foreground text-[10px] font-semibold uppercase tracking-wider mb-1.5">
          <span className="flex items-center gap-1.5 truncate">
            <Icon className="h-3 w-3 shrink-0" />
            <span className="truncate">{label}</span>
          </span>
          {badge !== undefined && (
            <Badge
              variant="secondary"
              className="h-4 px-1 text-[9px] font-bold rounded-sm shrink-0"
            >
              {badge}
            </Badge>
          )}
        </div>
        <div className="flex items-baseline gap-2">
          <div className="text-sm font-bold tabular-nums text-foreground">
            {value}
          </div>
          {trend && (
            <span
              className={cn(
                'text-[10px] font-semibold tabular-nums',
                trend.positive ? 'text-emerald-600' : 'text-red-600'
              )}
            >
              {trend.positive ? '+' : ''}
              {trend.value.toFixed(1)}%
            </span>
          )}
        </div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  )
}
