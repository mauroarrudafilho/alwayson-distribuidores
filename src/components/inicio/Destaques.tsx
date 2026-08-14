import { Sparkles, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { SectionTitle } from '@/components/distribuidor/SectionTitle'
import { Panel } from '@/components/distribuidor/Panel'
import { EmptyState } from '@/components/distribuidor/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import { useDestaques, type Destaque } from '@/hooks/useDestaques'
import { formatBRLCompact } from '@/lib/format'
import { cn } from '@/lib/utils'

function linkPara(d: Destaque): string {
  if (d.tipo === 'produto') return '/performance?tab=produtos'
  return `/performance?tab=distribuidor&distribuidor=${d.chave}`
}

function LinhaDestaque({ d }: { d: Destaque }) {
  const subiu = d.variacaoPercentual >= 0
  const sinal = subiu ? '+' : ''
  return (
    <Link
      to={linkPara(d)}
      className="group flex items-start gap-3 rounded-md px-2 py-2 transition-colors hover:bg-muted/40"
    >
      <span
        className={cn(
          'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border',
          subiu
            ? 'border-teal/20 bg-teal/8 text-teal'
            : 'border-destructive/20 bg-destructive/8 text-destructive'
        )}
      >
        {subiu ? (
          <TrendingUp className="h-3.5 w-3.5" strokeWidth={1.75} />
        ) : (
          <TrendingDown className="h-3.5 w-3.5" strokeWidth={1.75} />
        )}
      </span>
      <span className="min-w-0 flex-1 text-[13px] leading-snug">
        <span className="font-medium text-foreground">{d.rotulo}</span>{' '}
        <span className={cn('font-semibold tabular-nums', subiu ? 'text-teal' : 'text-destructive')}>
          {sinal}
          {d.variacaoPercentual.toFixed(1)}%
        </span>{' '}
        <span className="text-muted-foreground">
          — {formatBRLCompact(d.atual)} vs {formatBRLCompact(d.anterior)} no mesmo período
        </span>
      </span>
      <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-teal" />
    </Link>
  )
}

/**
 * Destaques automáticos do Início — 3–4 frases com as maiores altas/quedas por
 * distribuidor e por produto no ano (vs ano anterior).
 */
export function Destaques() {
  const { data, isLoading } = useDestaques()

  return (
    <Panel>
      <SectionTitle title="Destaques do ano" icon={Sparkles} />
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-9 rounded-lg" />
          <Skeleton className="h-9 rounded-lg" />
          <Skeleton className="h-9 rounded-lg" />
          <Skeleton className="h-9 rounded-lg" />
        </div>
      ) : data && (data.altas.length > 0 || data.quedas.length > 0) ? (
        <div className="space-y-0.5">
          {data.altas.slice(0, 2).map((d) => (
            <LinhaDestaque key={`a-${d.tipo}-${d.chave}`} d={d} />
          ))}
          {data.quedas.slice(0, 2).map((d) => (
            <LinhaDestaque key={`q-${d.tipo}-${d.chave}`} d={d} />
          ))}
        </div>
      ) : (
        <EmptyState
          compact
          icon={Sparkles}
          title="Sem destaques"
          description="Precisa de um ano completo de dado para comparar."
        />
      )}
    </Panel>
  )
}
