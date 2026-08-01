import { useState } from 'react'
import { ClientTag } from '@/components/distribuidor/ClientTag'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatCurrency } from '@/lib/format'
import {
  describeBenchmarkRule,
  formatAtingidoPct,
  type CidadeGapPerCapita,
  type GapBenchmark,
} from '@/lib/insights-gap-per-capita'
import { formatPerCapitaCurrency } from '@/lib/insights-per-capita'
import { cn } from '@/lib/utils'

type Props = {
  gap: CidadeGapPerCapita | null | undefined
  benchmark?: GapBenchmark | null
  className?: string
  emptyLabel?: string
}

/** Status de gap vs. referência de potencial (P90 com exclusões de cliente). */
export function InsightsGapStatus({
  gap,
  benchmark,
  className,
  emptyLabel = 'Sem IBGE',
}: Props) {
  const [open, setOpen] = useState(false)

  if (!gap) {
    return (
      <ClientTag
        category="segmento"
        label={emptyLabel}
        title="Sem população IBGE para calcular gap per capita"
        className={className}
      />
    )
  }

  const bench = gap.benchmark ?? benchmark

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button
        type="button"
        className={cn(
          'inline-flex rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring',
          className
        )}
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <ClientTag
          category={gap.category}
          label={gap.label}
          title="Clique para ver o potencial vs. referência parametrizada"
        />
      </button>
      <DialogContent
        className="sm:max-w-md"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle className="pr-8 text-base">
            Potencial · {gap.cidade}/{gap.estado}
          </DialogTitle>
          <DialogDescription>
            Referência e ranking usam fat./hab <strong>limpo</strong> (sem clientes da
            Parametrização). O total histórico só aparece como referência.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          {gap.tem_exclusao ? (
            <p className="rounded-md border border-info/30 bg-info/8 px-3 py-2 text-xs">
              Cliente(s) excluídos nesta cidade. Conta limpa:{' '}
              <span className="font-medium tabular-nums">
                {formatCurrency(gap.faturamento_limpo)}
              </span>
              {' · '}
              {formatPerCapitaCurrency(gap.faturamento_per_capita_limpo)}/hab ·{' '}
              {gap.total_clientes_limpos} cli · total histórico{' '}
              {formatCurrency(gap.faturamento_total)}.
            </p>
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            <Metric label="Fat. limpo" value={formatCurrency(gap.faturamento_limpo)} />
            <Metric
              label="Fat. / hab limpo"
              value={formatPerCapitaCurrency(gap.faturamento_per_capita_limpo)}
              accent
            />
            <Metric
              label="População"
              value={gap.populacao.toLocaleString('pt-BR')}
            />
            <Metric label="% da referência" value={formatAtingidoPct(gap.atingido_pct)} />
          </div>

          {bench ? (
            <div className="rounded-lg border border-border/60 bg-muted/25 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Referência · {bench.metodo}
              </p>
              <p className="mt-1 font-medium">
                Âncora {bench.cidade}{' '}
                <span className="text-xs uppercase text-muted-foreground">{bench.estado}</span>
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                {formatPerCapitaCurrency(bench.faturamento_per_capita)}/hab · pool{' '}
                {bench.pool_size} · {bench.excluded_clientes} cliente(s) fora
              </p>
              <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                {describeBenchmarkRule(bench)}
              </p>
            </div>
          ) : null}

          <div className="rounded-lg border border-teal/25 bg-teal/5 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-teal">
              Potencial da cidade
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              população × fat./hab de referência (base limpa)
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Metric label="Potencial" value={formatCurrency(gap.potencial_faturamento)} />
              <Metric
                label="Gap (oportunidade)"
                value={formatCurrency(gap.gap_faturamento)}
                accent
              />
            </div>
          </div>

          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Status <span className="font-medium text-foreground">{gap.label}</span>
            {gap.nivel === 'referencia'
              ? ' — perto ou acima da referência de potencial.'
              : ' — espaço para crescer até a referência parametrizada.'}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Metric({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div className="rounded-md border border-border/50 bg-card px-2.5 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          'mt-0.5 truncate text-sm font-semibold tabular-nums',
          accent && 'text-teal'
        )}
      >
        {value}
      </p>
    </div>
  )
}
