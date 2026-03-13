import type { ReactNode } from 'react'

interface KPIGridProps {
  children: ReactNode
  columns?: 2 | 3 | 4
}

export function KPIGrid({ children, columns = 4 }: KPIGridProps) {
  const gridCols = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  }

  return <div className={`grid ${gridCols[columns]} gap-3`}>{children}</div>
}
