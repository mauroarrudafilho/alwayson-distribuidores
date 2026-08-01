import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  className?: string
  /** Compact for nested panels / cards */
  compact?: boolean
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center text-center',
        compact ? 'py-8' : 'py-14',
        className
      )}
    >
      <div
        className={cn(
          'relative flex items-center justify-center rounded-md border border-navy/10 bg-navy/[0.03]',
          compact ? 'h-11 w-11' : 'h-14 w-14'
        )}
      >
        <Icon
          className={cn(
            'text-navy/35',
            compact ? 'h-5 w-5' : 'h-6 w-6'
          )}
          strokeWidth={1.5}
        />
        <span
          className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-teal/80"
          aria-hidden
        />
      </div>
      <p
        className={cn(
          'mt-4 font-display text-foreground',
          compact ? 'text-base' : 'text-lg'
        )}
        style={{ fontVariationSettings: '"opsz" 18, "SOFT" 30' }}
      >
        {title}
      </p>
      {description && (
        <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
      {action && (
        <Button
          variant="outline"
          size="sm"
          className="mt-5 border-navy/15 text-[11px] uppercase tracking-[0.14em]"
          onClick={action.onClick}
        >
          {action.label}
        </Button>
      )}
    </div>
  )
}
