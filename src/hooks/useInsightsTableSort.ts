import { useMemo, useState } from 'react'

export type InsightsSortDir = 'asc' | 'desc'

export type InsightsSortState<K extends string> = {
  key: K
  dir: InsightsSortDir
}

/**
 * Ordenação clicável para tabelas Insights (padrão: desc na 1ª coluna numérica).
 */
export function useInsightsTableSort<T, K extends string>(
  rows: T[],
  accessors: Record<K, (row: T) => string | number | null | undefined>,
  initial: InsightsSortState<K>
) {
  const [sort, setSort] = useState<InsightsSortState<K>>(initial)

  function toggle(key: K) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'desc' ? 'asc' : 'desc' }
        : { key, dir: 'desc' }
    )
  }

  const sorted = useMemo(() => {
    const acc = accessors[sort.key]
    const mul = sort.dir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      const va = acc(a)
      const vb = acc(b)
      if (va == null && vb == null) return 0
      if (va == null) return 1
      if (vb == null) return -1
      if (typeof va === 'number' && typeof vb === 'number') {
        return (va - vb) * mul
      }
      return String(va).localeCompare(String(vb), 'pt-BR', { sensitivity: 'base' }) * mul
    })
  }, [rows, accessors, sort])

  return { sort, toggle, sorted }
}
