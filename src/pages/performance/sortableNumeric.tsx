import { useMemo, useState } from 'react'
import { ArrowUpDown } from 'lucide-react'
import { TableHead } from '@/components/ui/table'
import { cn } from '@/lib/utils'

export type SortDir = 'asc' | 'desc'

export type PerfMetricKey = 'faturamento' | 'positivados' | 'itens' | 'pedidos' | 'variacao'

export function useNumericSort<K extends string>(
  defaultField: K,
  defaultDir: SortDir = 'desc'
) {
  const [sortField, setSortField] = useState<K>(defaultField)
  const [sortDir, setSortDir] = useState<SortDir>(defaultDir)

  function toggleSort(field: K) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  return { sortField, sortDir, toggleSort }
}

export function useSortedMetricRows<T extends Partial<Record<PerfMetricKey, number | null>>>(
  rows: T[],
  defaultField: PerfMetricKey = 'faturamento'
) {
  const { sortField, sortDir, toggleSort } = useNumericSort(defaultField)

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      const va = a[sortField]
      const vb = b[sortField]
      const na = va === null || va === undefined
      const nb = vb === null || vb === undefined
      if (na && nb) return 0
      if (na) return 1   // nulos sempre no fim…
      if (nb) return -1  // …independentemente da direção
      const cmp = Number(va) - Number(vb)
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [rows, sortField, sortDir])

  return { sortedRows, sortField, sortDir, toggleSort }
}

interface SortableNumericHeadProps<K extends string> {
  label: string
  field: K
  sortField: K
  sortDir: SortDir
  onSort: (field: K) => void
  className?: string
}

export function SortableNumericHead<K extends string>({
  label,
  field,
  sortField,
  sortDir,
  onSort,
  className,
}: SortableNumericHeadProps<K>) {
  const active = sortField === field
  return (
    <TableHead className={cn('text-right', className)}>
      <button
        type="button"
        className={cn(
          'inline-flex items-center justify-end gap-1 ml-auto w-full',
          'text-[11px] font-semibold uppercase tracking-wider transition-colors',
          active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
        )}
        onClick={() => onSort(field)}
        aria-label={`Ordenar por ${label}${active ? ` (${sortDir === 'asc' ? 'crescente' : 'decrescente'})` : ''}`}
      >
        {label}
        <ArrowUpDown
          className={cn(
            'h-3 w-3 shrink-0',
            active ? 'text-foreground' : 'text-muted-foreground/50'
          )}
        />
      </button>
    </TableHead>
  )
}
