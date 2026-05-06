import type { ReactNode } from 'react'

interface KPIGridProps {
  children: ReactNode
  columns?: 2 | 3 | 4 | 5
  className?: string
}

export function KPIGrid({ children, columns = 4, className }: KPIGridProps) {
  const gridCols = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-2 md:grid-cols-4',
    5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
  }

  return <div className={`grid ${gridCols[columns]} gap-4 ${className ?? ''}`}>{children}</div>
}
