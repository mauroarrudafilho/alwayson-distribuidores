import type { InsightsOtica } from '@/lib/insights-contextual-kpis'
import { cn } from '@/lib/utils'

const OTICA_COPY: Record<InsightsOtica, { title: string; description: string }> = {
  clientes: {
    title: 'Monte seu plano por cliente',
    description:
      'Priorize quem parou de comprar. Cada linha traz contexto de mix e status de ação.',
  },
  produtos: {
    title: 'Foco no mix',
    description:
      'Quanto cada SKU representa do faturamento total — e onde aprofundar o argumento de venda.',
  },
  territorio: {
    title: 'Mercados e penetração',
    description:
      'Nordeste: faturamento por habitante e concentração geográfica para achar mercados aquecidos ou subpenetrados.',
  },
}

type Props = {
  otica: InsightsOtica
  periodoLabel: string
  className?: string
  /** Quando true, só mostra o título curto (sem banner). */
  compact?: boolean
}

export function InsightsOticaIntro({ otica, periodoLabel, className, compact }: Props) {
  const copy = OTICA_COPY[otica]
  if (compact) {
    return (
      <p className={cn('mb-4 text-sm text-muted-foreground', className)}>
        <span className="font-medium text-foreground">{copy.title}</span>
        <span className="mx-1.5 text-border">·</span>
        {periodoLabel}
      </p>
    )
  }
  return (
    <div
      className={cn(
        'mb-5 rounded-lg border border-border/60 bg-gradient-to-br from-navy/[0.03] to-teal/[0.04] px-4 py-3.5',
        className
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wider text-teal/90">
        Plano de ação · {periodoLabel}
      </p>
      <h2 className="mt-1 font-display text-base font-normal text-foreground">{copy.title}</h2>
      <p className="mt-1 text-sm text-muted-foreground leading-relaxed max-w-3xl">{copy.description}</p>
    </div>
  )
}
