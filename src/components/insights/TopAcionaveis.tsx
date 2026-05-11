import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface TopAcionaveisProps<T> {
  /** Eyebrow uppercase ex.: "Prioridade · Clientes a recuperar". */
  eyebrow: string
  /** Frase curta logo abaixo do eyebrow, ex.: regra do ranking. */
  description?: string
  items: T[]
  getKey: (item: T) => string
  renderItem: (item: T, rank: number) => ReactNode
  onItemClick?: (item: T) => void
  /** 1 ou 2 colunas. Default 2. */
  columns?: 1 | 2
  className?: string
}

export function TopAcionaveis<T>({
  eyebrow,
  description,
  items,
  getKey,
  renderItem,
  onItemClick,
  columns = 2,
  className,
}: TopAcionaveisProps<T>) {
  if (items.length === 0) return null
  const clickable = !!onItemClick

  return (
    <section className={cn('mb-6', className)}>
      <header className="mb-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {eyebrow}
        </p>
        {description && (
          <p className="mt-1 text-xs text-muted-foreground/80">{description}</p>
        )}
      </header>

      <div
        className={cn(
          'grid overflow-hidden rounded-md border border-border/60 bg-border/40',
          columns === 1 ? 'gap-px grid-cols-1' : 'gap-px grid-cols-1 lg:grid-cols-2'
        )}
      >
        {items.map((item, idx) => {
          const inner = (
            <>
              <span className="w-6 shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground/80">
                {String(idx + 1).padStart(2, '0')}
              </span>
              <div className="min-w-0 flex-1">{renderItem(item, idx + 1)}</div>
            </>
          )

          const base =
            'flex items-center gap-3 px-4 py-3 bg-card text-left transition-colors'

          if (clickable) {
            return (
              <button
                key={getKey(item)}
                type="button"
                onClick={() => onItemClick(item)}
                className={cn(base, 'cursor-pointer hover:bg-muted/40')}
              >
                {inner}
              </button>
            )
          }
          return (
            <div key={getKey(item)} className={base}>
              {inner}
            </div>
          )
        })}
      </div>
    </section>
  )
}
