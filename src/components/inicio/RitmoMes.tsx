import { TrendingUp } from 'lucide-react'
import { Link } from 'react-router-dom'
import { SectionTitle } from '@/components/distribuidor/SectionTitle'
import { Panel } from '@/components/distribuidor/Panel'
import { EmptyState } from '@/components/distribuidor/EmptyState'
import { MetaProgressBar } from '@/components/distribuidor/MetaProgressBar'
import { Skeleton } from '@/components/ui/skeleton'
import { usePacing } from '@/hooks/usePacing'
import { formatCurrency, formatBRLCompact } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * Ritmo do mês — realizado vs meta por distribuidor com a projeção de
 * fechamento no ritmo atual e o valor que falta por dia útil.
 */
export function RitmoMes() {
  const { data, isLoading } = usePacing()

  return (
    <Panel>
      <SectionTitle
        title="Ritmo do mês"
        icon={TrendingUp}
        action={
          <Link to="/metas">
            <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground">
              Metas
            </span>
          </Link>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Skeleton className="h-32 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
        </div>
      ) : data && data.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {data.map((c) => (
            <div
              key={c.distribuidor_id}
              className="flex flex-col justify-between gap-3 rounded-lg border border-border/60 bg-muted/30 p-4"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-medium text-foreground">
                  {c.distribuidor_nome}
                </span>
                <span className="shrink-0 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  {c.dias_uteis_decorridos}/{c.dias_uteis_totais} dias úteis
                </span>
              </div>

              <MetaProgressBar
                label="Atingimento do mês"
                percentual={c.percentual_atingimento ?? 0}
                meta={formatCurrency(c.meta)}
                realizado={formatCurrency(c.realizado)}
              />

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    Fecha no ritmo atual
                  </p>
                  <p
                    className={cn(
                      'mt-0.5 font-display text-base tabular-nums tracking-tight',
                      c.percentual_projecao !== null &&
                        c.percentual_projecao >= 100 &&
                        'text-success'
                    )}
                  >
                    {c.projecao_fechamento !== null
                      ? formatBRLCompact(c.projecao_fechamento)
                      : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    Falta por dia útil
                  </p>
                  <p className="mt-0.5 font-display text-base tabular-nums tracking-tight">
                    {c.valor_dia_util_necessario !== null
                      ? formatBRLCompact(Math.max(c.valor_dia_util_necessario, 0))
                      : '—'}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          compact
          icon={TrendingUp}
          title="Sem meta para o mês"
          description="Cadastre a meta de faturamento do mês para acompanhar o ritmo."
        />
      )}
    </Panel>
  )
}
