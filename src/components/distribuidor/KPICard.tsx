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
        variant === 'primary'
          ? 'border-primary/20 bg-primary/5'
          : ''
      )}
      size="sm"
    >
      <CardContent>
        <div className="flex items-center justify-between gap-2 text-muted-foreground text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider mb-2">
          <span className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
            <span className="leading-tight">{label}</span>
          </span>
          {badge !== undefined && (
            <Badge
              variant="secondary"
              className="shrink-0"
            >
              {badge}
            </Badge>
          )}
        </div>
        <div className="flex items-baseline gap-2">
          <div className="text-base sm:text-lg font-bold tabular-nums text-foreground">
            {value}
          </div>
          {trend && (
            <span
              className={cn(
                'text-xs font-semibold tabular-nums',
                trend.positive ? 'text-success' : 'text-destructive'
              )}
            >
              {trend.positive ? '+' : ''}
              {trend.value.toFixed(1)}%
            </span>
          )}
        </div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1.5">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  )
}
