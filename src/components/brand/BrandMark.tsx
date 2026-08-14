import { cn } from '@/lib/utils'

type BrandMarkTone = 'onDark' | 'onLight'
type BrandMarkSize = 'sm' | 'md'

interface BrandMarkProps {
  tone?: BrandMarkTone
  size?: BrandMarkSize
  /** Só o monograma; sem wordmark. */
  markOnly?: boolean
  /** Wordmark em duas linhas (nome + produto). */
  stacked?: boolean
  /** Linha terciária sob o wordmark (ex.: M.I.R.A. · 2026). */
  caption?: string
  className?: string
}

const markSize: Record<BrandMarkSize, string> = {
  sm: 'h-7 w-7 text-[11px]',
  md: 'h-9 w-9 text-sm',
}

/**
 * Monograma M.I.R.A. — mesma linguagem do login (M + pulso teal).
 */
export function BrandMark({
  tone = 'onDark',
  size = 'sm',
  markOnly = false,
  stacked = true,
  caption,
  className,
}: BrandMarkProps) {
  const onDark = tone === 'onDark'

  return (
    <div className={cn('flex min-w-0 items-center gap-2.5', className)}>
      <div
        className={cn(
          'relative flex shrink-0 items-center justify-center rounded-md border backdrop-blur-sm',
          markSize[size],
          onDark
            ? 'border-white/15 bg-white/5 text-white'
            : 'border-navy/15 bg-navy/4 text-navy'
        )}
      >
        <span
          className="leading-none"
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 500,
            fontVariationSettings: '"opsz" 12',
          }}
        >
           M
        </span>
        <span
          className={cn(
            'absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-teal',
            size === 'md' && 'h-2 w-2',
            onDark && 'shadow-[0_0_10px_var(--teal)]'
          )}
          aria-hidden
        />
      </div>

      {!markOnly && (
        <div className="flex min-w-0 flex-col leading-tight">
          {stacked ? (
            <>
              <span
                className={cn(
                  'truncate text-[13px] font-medium tracking-tight',
                  onDark ? 'text-white' : 'text-foreground'
                )}
              >
                M.I.R.A.
              </span>
              <span
                className={cn(
                  'truncate text-[10px] uppercase tracking-[0.18em]',
                  onDark ? 'text-white/50' : 'text-muted-foreground'
                )}
              >
                Sales Platform
              </span>
            </>
          ) : (
            <span
              className={cn(
                'truncate text-sm font-medium tracking-tight',
                onDark ? 'text-white' : 'text-foreground'
              )}
            >
              M.I.R.A. Sales Platform
            </span>
          )}
          {caption && (
            <span
              className={cn(
                'mt-0.5 truncate text-[10px] uppercase tracking-[0.22em]',
                onDark ? 'text-white/55' : 'text-muted-foreground'
              )}
            >
              {caption}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
