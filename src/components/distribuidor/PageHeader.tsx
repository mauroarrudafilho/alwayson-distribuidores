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
    // Empilha no telemóvel: título e ações numa linha só espremem os dois.
    <div className="mb-6 flex flex-col items-start gap-3 border-b border-border/70 pb-4 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
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
          {/* Inline só em ecrã mesmo largo (xl): abaixo disso a descrição parte o
              título a meio da frase e encosta no botão de ação. */}
          {description && (
            <span className="ml-2 hidden align-baseline text-sm font-normal tracking-normal text-muted-foreground xl:inline">
              — {description}
            </span>
          )}
        </h1>
        {description && (
          <p className="mt-1 text-[13px] leading-snug text-muted-foreground xl:hidden">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto">{actions}</div>
      )}
    </div>
  )
}
