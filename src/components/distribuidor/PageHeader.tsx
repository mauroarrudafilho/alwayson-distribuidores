import type { ReactNode } from 'react'

const DEFAULT_EYEBROW = 'AlwaysOn · Distribuidores'

interface PageHeaderProps {
  title: string
  description?: string
  actions?: ReactNode
  /** Defaults to AlwaysOn brand line. Pass `null` to hide. */
  eyebrow?: string | null
  accent?: string
}

export function PageHeader({
  title,
  description,
  actions,
  eyebrow = DEFAULT_EYEBROW,
  accent,
}: PageHeaderProps) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4 border-b border-border/70 pb-4">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1.5 flex items-center text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
            <span className="mr-3 inline-block h-px w-[22px] bg-teal/70" aria-hidden />
            {eyebrow}
          </p>
        )}
        <h1
          className="font-display text-[22px] font-normal leading-tight tracking-[-0.015em] text-foreground sm:text-[26px]"
          style={{ fontVariationSettings: '"opsz" 24, "SOFT" 30' }}
        >
          {title}
          {accent && (
            <>
              {' '}
              <em
                className="font-display italic text-teal"
                style={{ fontVariationSettings: '"opsz" 24, "SOFT" 50' }}
              >
                {accent}
              </em>
              <span className="text-foreground">.</span>
            </>
          )}
          {description && (
            <span className="ml-2 align-baseline text-sm font-normal tracking-normal text-muted-foreground">
              — {description}
            </span>
          )}
        </h1>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}
