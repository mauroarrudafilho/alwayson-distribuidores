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
  variant?: 'default' | 'primary' | 'primary-quiet'
  trend?: { value: number; positive: boolean }
}

const variantClass: Record<NonNullable<KPICardProps['variant']>, string> = {
  default: '',
  primary: 'border-primary/20 bg-primary/5',
  'primary-quiet': 'border-primary/15 bg-primary/[0.04]',
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
    <Card className={cn(variantClass[variant])} size="sm">
      <CardContent>
        <div className="flex items-center justify-between gap-2 text-muted-foreground text-[11px] font-semibold uppercase tracking-[0.22em] mb-2">
          <span className="flex items-center gap-2 min-w-0">
            <Icon className="h-4 w-4 shrink-0" />
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
          <div className="text-lg font-bold tabular-nums text-foreground">
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
