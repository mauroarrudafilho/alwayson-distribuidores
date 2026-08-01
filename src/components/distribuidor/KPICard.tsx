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
  default: 'border-border/70 bg-card/80',
  primary: 'border-navy/15 bg-navy/[0.04]',
  'primary-quiet': 'border-navy/10 bg-navy/[0.025]',
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
    <Card className={cn('shadow-none', variantClass[variant])} size="sm">
      <CardContent>
        <div className="mb-2 flex items-center justify-between gap-2 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          <span className="flex min-w-0 items-center gap-2">
            <Icon className="h-3.5 w-3.5 shrink-0 text-teal" strokeWidth={1.75} />
            <span className="leading-tight">{label}</span>
          </span>
          {badge !== undefined && (
            <Badge variant="secondary" className="shrink-0">
              {badge}
            </Badge>
          )}
        </div>
        <div className="flex items-baseline gap-2">
          <div className="font-display text-lg font-normal tabular-nums tracking-tight text-foreground">
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
          <p className="mt-1.5 text-xs text-muted-foreground">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  )
}
