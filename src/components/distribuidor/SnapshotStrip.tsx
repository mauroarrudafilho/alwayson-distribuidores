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
        'grid overflow-hidden rounded-lg border border-border bg-card shadow-card',
        className
      )}
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      {items.map((it, i) => (
        <div
          key={`${it.label}-${i}`}
          className={cn(
            'flex flex-col gap-0.5 px-3.5 py-2.5',
            i < items.length - 1 && 'border-r border-border'
          )}
        >
          <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {it.label}
          </span>
          <span className="text-sm font-semibold tabular-nums text-foreground">
            {it.value}
          </span>
          {it.delta && (
            <span
              className={cn(
                'text-[10px] font-semibold tabular-nums',
                toneClass[it.tone ?? 'flat']
              )}
            >
              {it.delta}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
