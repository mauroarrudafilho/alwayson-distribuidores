import type { ReactNode } from 'react'
import { Card, CardContent } from '@/components/ui/card'

interface FilterBarProps {
  children: ReactNode
  columns?: 2 | 3 | 4
}

export function FilterBar({ children, columns = 3 }: FilterBarProps) {
  const gridCols = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  }

  return (
    <Card className="mb-6">
      <CardContent>
        <div className={`grid ${gridCols[columns]} gap-3 sm:gap-4`}>
          {children}
        </div>
      </CardContent>
    </Card>
  )
}

interface FilterFieldProps {
  label: string
  children: ReactNode
}

export function FilterField({ label, children }: FilterFieldProps) {
  return (
    <div>
      <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
        {label}
      </label>
      {children}
    </div>
  )
}
