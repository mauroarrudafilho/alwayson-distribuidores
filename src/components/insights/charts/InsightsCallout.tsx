import type { ReactNode } from 'react'
import { Lightbulb } from 'lucide-react'
import { cn } from '@/lib/utils'

export function InsightsCallout({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5 text-sm text-foreground',
        className
      )}
    >
      <Lightbulb className="w-4 h-4 shrink-0 text-primary mt-0.5" aria-hidden />
      <div className="min-w-0 space-y-1 leading-snug">{children}</div>
    </div>
  )
}
