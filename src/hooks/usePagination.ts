import { useEffect, useMemo, useState } from 'react'

interface UsePaginationOptions<T> {
  items: T[]
  initialPageSize?: number
  /** Quando muda, volta para a página 1 (ex.: filtros aplicados). */
  resetKey?: unknown
}

interface UsePaginationResult<T> {
  page: number
  pageSize: number
  setPage: (page: number) => void
  setPageSize: (size: number) => void
  paginated: T[]
  total: number
}

export function usePagination<T>({
  items,
  initialPageSize = 25,
  resetKey,
}: UsePaginationOptions<T>): UsePaginationResult<T> {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSizeState] = useState(initialPageSize)

  useEffect(() => {
    setPage(1)
  }, [resetKey])

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
    if (page > totalPages) setPage(totalPages)
  }, [items.length, pageSize, page])

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize
    return items.slice(start, start + pageSize)
  }, [items, page, pageSize])

  return {
    page,
    pageSize,
    setPage,
    setPageSize: (size: number) => {
      setPageSizeState(size)
      setPage(1)
    },
    paginated,
    total: items.length,
  }
}
