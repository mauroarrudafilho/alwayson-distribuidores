import { cn } from '@/lib/utils'

export interface SnapshotItem {
  label: string
  value: string
  delta?: string
  tone?: 'up' | 'down' | 'flat'
}

interface SnapshotStripProps {
  items: SnapshotItem[]
  className?: string
}

const toneClass: Record<NonNullable<SnapshotItem['tone']>, string> = {
  up: 'text-success',
  down: 'text-destructive',
  flat: 'text-muted-foreground',
}

export function SnapshotStrip({ items, className }: SnapshotStripProps) {
  return (
    <div
      className={cn(
        'overflow-x-auto rounded-lg border border-border/70 bg-card/90 shadow-[0_1px_2px_oklch(0_0_0/4%)]',
        className
      )}
    >
      <div
        className="grid min-w-max sm:min-w-0"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(7.5rem, 1fr))` }}
      >
        {items.map((it, i) => (
          <div
            key={`${it.label}-${i}`}
            className={cn(
              'relative flex flex-col gap-0.5 px-3.5 py-3',
              i < items.length - 1 && 'border-r border-border/60'
            )}
          >
            {i === 0 && (
              <span
                className="absolute left-0 top-2.5 bottom-2.5 w-0.5 rounded-full bg-teal"
                aria-hidden
              />
            )}
            <span className="text-[9px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              {it.label}
            </span>
            <span className="font-display text-[15px] font-normal tabular-nums tracking-tight text-foreground">
              {it.value}
            </span>
            {it.delta && (
              <span
                className={cn(
                  'text-[10px] font-medium tabular-nums',
                  toneClass[it.tone ?? 'flat']
                )}
              >
                {it.delta}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
