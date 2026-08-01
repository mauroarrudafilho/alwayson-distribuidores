import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BrandMark } from '@/components/brand/BrandMark'

interface AuthShellProps {
  eyebrow: string
  title: string
  italic: string
  children: ReactNode
}

/**
 * Compact auth layout (recover / reset / invite) — same brand language as Login.
 */
export function AuthShell({ eyebrow, title, italic, children }: AuthShellProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[oklch(0.98_0.005_250)] px-6 py-10 sm:px-10">
      <div className="w-full max-w-[440px] [animation:var(--animate-rise-in)]">
        <div className="mb-12 flex items-center justify-between gap-4">
          <Link to="/login" className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-navy/30">
            <BrandMark tone="onLight" size="sm" stacked />
          </Link>
          <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
            v1.0
          </span>
        </div>

        <p className="text-[11px] font-medium uppercase tracking-[0.32em] text-muted-foreground editorial-rule">
          {eyebrow}
        </p>
        <h1
          className="mt-3 text-[42px] leading-[1.02] tracking-[-0.02em] text-foreground sm:text-[48px]"
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 360,
            fontVariationSettings: '"opsz" 144, "SOFT" 30',
          }}
        >
          {title}{' '}
          <em
            className="italic text-navy"
            style={{ fontVariationSettings: '"opsz" 144, "SOFT" 50' }}
          >
            {italic}
          </em>
        </h1>
        {children}
      </div>
    </div>
  )
}
