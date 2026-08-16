import { cn } from '@/lib/utils'
import { MeshDiamond } from './MeshDiamond'

type BrandMarkTone = 'onDark' | 'onLight'
type BrandMarkSize = 'sm' | 'md' | 'hero'

interface BrandMarkProps {
  tone?: BrandMarkTone
  size?: BrandMarkSize
  /** Só o símbolo; sem wordmark. */
  markOnly?: boolean
  /** Wordmark em duas linhas (nome + descritor). */
  stacked?: boolean
  /** Linha terciária sob o wordmark (ex.: Mesh · 2026). */
  caption?: string
  className?: string
}

const markSize: Record<BrandMarkSize, string> = {
  sm: 'h-7 w-7',
  md: 'h-9 w-9',
  hero: 'h-24 w-24',
}

/** Densidade da malha por tamanho real de render — ver MeshDiamond.tsx. */
const markSubdivisions: Record<BrandMarkSize, number> = {
  sm: 2,
  md: 3,
  hero: 5,
}

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
          size === 'hero' && 'rounded-2xl',
          onDark
            ? 'border-white/15 bg-white/5 text-white'
            : 'border-ink/15 bg-ink/4 text-ink'
        )}
      >
        <MeshDiamond subdivisions={markSubdivisions[size]} className="h-[62%] w-[62%]" />
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
                Mesh
              </span>
              <span
                className={cn(
                  'truncate text-[10px] uppercase tracking-[0.18em]',
                  onDark ? 'text-white/50' : 'text-muted-foreground'
                )}
              >
                Canal indireto
              </span>
            </>
          ) : (
            <span
              className={cn(
                'truncate text-sm font-medium tracking-tight',
                onDark ? 'text-white' : 'text-foreground'
              )}
            >
              Mesh, inteligência de canal indireto
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
