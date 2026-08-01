import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface FilterBarProps {
  children: ReactNode
  columns?: 2 | 3 | 4
  className?: string
}

export function FilterBar({ children, columns = 3, className }: FilterBarProps) {
  const gridCols = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  }

  return (
    <div
      className={cn(
        'mb-6 rounded-lg border border-border/70 border-l-2 border-l-teal/60 bg-card/60 px-3.5 py-3.5',
        className
      )}
    >
      <div className={cn('grid gap-3 sm:gap-4', gridCols[columns])}>{children}</div>
    </div>
  )
}

interface FilterFieldProps {
  label: string
  children: ReactNode
}

export function FilterField({ label, children }: FilterFieldProps) {
  return (
    <div>
      <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  )
}
