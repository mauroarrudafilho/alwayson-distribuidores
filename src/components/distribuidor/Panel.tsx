import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PanelProps {
  children: ReactNode
  className?: string
  /** Soft top accent rule (brand) */
  accent?: boolean
}

/** Lighter surface than Card — for list/ranking sections without card clutter. */
export function Panel({ children, className, accent = false }: PanelProps) {
  return (
    <section
      className={cn(
        'rounded-lg border border-border/70 bg-card/80 p-3.5 shadow-[0_1px_2px_oklch(0_0_0/4%)]',
        accent && 'border-t-2 border-t-teal/70',
        className
      )}
    >
      {children}
    </section>
  )
}
