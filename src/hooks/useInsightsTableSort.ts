import { useMemo, useState } from 'react'

export type InsightsSortDir = 'asc' | 'desc'

export type InsightsSortState<K extends string> = {
  key: K
  dir: InsightsSortDir
}

type SortAccessor<T> = (row: T) => string | number | null | undefined

/**
 * Ordenação clicável para tabelas Insights (padrão: desc na 1ª coluna numérica).
 * A chave K é inferida a partir das keys de `accessors` (não só do `initial`).
 */
export function useInsightsTableSort<
  T,
  A extends Record<string, SortAccessor<T>>,
>(
  rows: T[],
  accessors: A,
  initial: InsightsSortState<Extract<keyof A, string>>
) {
  type K = Extract<keyof A, string>
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
