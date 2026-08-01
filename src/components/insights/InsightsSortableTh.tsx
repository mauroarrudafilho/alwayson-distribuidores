import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { TableHead } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { InsightsSortDir } from '@/hooks/useInsightsTableSort'

type Props = {
  label: string
  active: boolean
  dir: InsightsSortDir
  onClick: () => void
  align?: 'left' | 'right'
  className?: string
}

/** Cabeçalho clicável — padrão de ranqueamento das tabelas Insights. */
export function InsightsSortableTh({
  label,
  active,
  dir,
  onClick,
  align = 'left',
  className,
}: Props) {
  const Icon = !active ? ArrowUpDown : dir === 'asc' ? ArrowUp : ArrowDown
  return (
    <TableHead
      className={cn(align === 'right' && 'text-right', className)}
      aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'inline-flex items-center gap-1 font-medium hover:text-foreground transition-colors',
          align === 'right' && 'flex-row-reverse',
          active ? 'text-foreground' : 'text-muted-foreground'
        )}
      >
        {label}
        <Icon className="size-3 opacity-70" />
      </button>
    </TableHead>
  )
}
