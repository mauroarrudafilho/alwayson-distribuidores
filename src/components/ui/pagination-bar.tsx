import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { Button } from './button'
import { cn } from '@/lib/utils'

interface PaginationBarProps {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (size: number) => void
  pageSizeOptions?: number[]
  className?: string
}

export function PaginationBar({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [25, 50, 100],
  className,
}: PaginationBarProps) {
  if (total === 0) return null

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  return (
    <div
      className={cn(
        'flex flex-col gap-2 px-4 py-2.5 border-t border-border/40 sm:flex-row sm:items-center sm:justify-between',
        className
      )}
    >
      <p className="text-xs text-muted-foreground tabular-nums">
        <span className="font-medium text-foreground">{from.toLocaleString('pt-BR')}</span>
        <span className="mx-1">–</span>
        <span className="font-medium text-foreground">{to.toLocaleString('pt-BR')}</span>
        <span className="ml-1">de {total.toLocaleString('pt-BR')}</span>
      </p>

      <div className="flex items-center gap-3">
        {onPageSizeChange && (
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            Por página
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-7 cursor-pointer rounded-md border border-input bg-background px-2 text-xs transition hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring/30"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            disabled={page === 1}
            onClick={() => onPageChange(1)}
            aria-label="Primeira página"
          >
            <ChevronsLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            disabled={page === 1}
            onClick={() => onPageChange(page - 1)}
            aria-label="Página anterior"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>

          <span className="px-2 text-xs tabular-nums">
            <span className="font-semibold text-foreground">{page}</span>
            <span className="text-muted-foreground"> / {totalPages}</span>
          </span>

          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            aria-label="Próxima página"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            disabled={page >= totalPages}
            onClick={() => onPageChange(totalPages)}
            aria-label="Última página"
          >
            <ChevronsRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
