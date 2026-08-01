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
  /** 1–3 colunas. Default 2. */
  columns?: 1 | 2 | 3
  className?: string
}

/**
 * Bloco de prioridade (fila / foco), tipografia alinhada às tabelas Insights:
 * título text-sm font-medium · meta text-xs muted.
 */
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
    <section
      className={cn(
        'mb-5 overflow-hidden rounded-lg border border-border/60 bg-card',
        className
      )}
    >
      <header className="border-b border-border/50 px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {eyebrow}
        </p>
        {description && (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        )}
      </header>

      <div
        className={cn(
          'grid divide-y divide-border/40 lg:divide-y-0',
          columns === 1 && 'grid-cols-1',
          columns === 2 && 'grid-cols-1 lg:grid-cols-2 lg:divide-x lg:divide-border/40',
          columns === 3 && 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3'
        )}
      >
        {items.map((item, idx) => {
          const inner = (
            <>
              <span className="w-6 shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                {String(idx + 1).padStart(2, '0')}
              </span>
              <div className="min-w-0 flex-1">{renderItem(item, idx + 1)}</div>
            </>
          )

          const base =
            'flex items-center gap-3 px-4 py-3 text-left transition-colors'

          if (clickable) {
            // div (não <button>) para permitir controles aninhados (ex.: status de gap)
            return (
              <div
                key={getKey(item)}
                role="button"
                tabIndex={0}
                onClick={() => onItemClick(item)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onItemClick(item)
                  }
                }}
                className={cn(base, 'cursor-pointer hover:bg-muted/40')}
              >
                {inner}
              </div>
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

/** Classes compartilhadas para título/meta nos topos e mercados. */
export const insightsListTitleClass = 'text-sm font-medium text-foreground truncate'
export const insightsListMetaClass = 'mt-0.5 text-xs text-muted-foreground tabular-nums'
