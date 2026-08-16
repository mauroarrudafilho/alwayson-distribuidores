import { cn } from '@/lib/utils'

type BrandMarkTone = 'onDark' | 'onLight'
type BrandMarkSize = 'sm' | 'md'

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
}

/**
 * Símbolo Mesh — losango de malha com um nó âmbar aceso.
 * Ver GUIA-DE-MARCA-MESH.md §6/§8. Este é o traçado simplificado
 * (mesh-mark-simple.svg): o completo (mesh-mark.svg, ~113 traços) só lê bem
 * a partir de uns 80px — nenhum uso de BrandMark no app chega lá (sm/md
 * ficam em 25–36px), então o traço fino dele sumiria/embaçaria na tela.
 * Reservar mesh-mark.svg pra peça futura de formato grande (marketing, print).
 */
function MeshSymbol({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" role="img" aria-label="Mesh" className={className}>
      <path
        d="M 32.0 3.84 L 60.16 32.0 L 32.0 60.16 L 3.84 32.0 Z"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <line x1="32.0" y1="3.84" x2="32.0" y2="60.16" stroke="currentColor" strokeWidth="2.5" />
      <line x1="3.84" y1="32.0" x2="60.16" y2="32.0" stroke="currentColor" strokeWidth="2.5" />
      <line x1="17.92" y1="17.92" x2="46.08" y2="46.08" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="46.08" cy="46.08" r="5.5" fill="var(--color-amber)" />
    </svg>
  )
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
          onDark
            ? 'border-white/15 bg-white/5 text-white'
            : 'border-ink/15 bg-ink/4 text-ink'
        )}
      >
        <MeshSymbol className="h-[62%] w-[62%]" />
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
