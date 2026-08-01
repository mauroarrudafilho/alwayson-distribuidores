import { useMemo } from 'react'
import { Loader2, TrendingUp, Users } from 'lucide-react'
import type { InsightsCidadeRow, InsightsMesGlobalRow } from '@/types/insights'
import { formatCurrency } from '@/lib/format'
import {
  InsightsChartCard,
  InsightsCallout,
  formatPercent,
} from '@/components/insights/charts'
import { InsightsHistoricoChart } from '@/components/insights/InsightsHistoricoChart'
import {
  enriquecerCidadesPerCapita,
  formatPerCapitaCurrency,
  formatVolumePerCapita,
} from '@/lib/insights-per-capita'
import {
  describeBenchmarkRule,
  lookupCidadeGap,
  topMaioresGaps,
  topOportunidadePerCapitaLimpo,
  formatAtingidoPct,
  type CidadeGapPerCapita,
  type GapsContext,
} from '@/lib/insights-gap-per-capita'
import { buildConcentracaoInsight } from '@/lib/insights-contextual-kpis'
import { useInsightsPopulacao } from '@/hooks/useInsightsPopulacao'
import {
  TopAcionaveis,
  insightsListMetaClass,
  insightsListTitleClass,
} from '@/components/insights/TopAcionaveis'
import { InsightsGapStatus } from '@/components/insights/InsightsGapStatus'
import { topCidadesPrioritarias } from '@/lib/insights-priority'

type Props = {
  cidades: InsightsCidadeRow[]
  faturamentoFiltrado: number
  mesGlobal?: InsightsMesGlobalRow[]
  onOpenCidade?: (cidade: string, estado: string) => void
  /** Gap/potencial com exclusões de cliente da parametrização. */
  gapsCtx: GapsContext
}

export function InsightsTerritorioLens({
  cidades,
  faturamentoFiltrado,
  mesGlobal = [],
  onOpenCidade,
  gapsCtx,
}: Props) {
  const refs = useMemo(
    () => cidades.map((c) => ({ cidade: c.cidade, estado: c.estado })),
    [cidades]
  )
  const popQ = useInsightsPopulacao(refs, cidades.length > 0)

  const perCapita = useMemo(
    () => enriquecerCidadesPerCapita(cidades, popQ.data ?? new Map()),
    [cidades, popQ.data]
  )

  const historicoData = useMemo(
    () =>
      [...mesGlobal]
        .sort((a, b) => a.ano_mes.localeCompare(b.ano_mes))
        .map((m) => ({ month: m.ano_mes, total: m.faturamento_total })),
    [mesGlobal]
  )

  const concentracao = useMemo(
    () => buildConcentracaoInsight(cidades, faturamentoFiltrado),
    [cidades, faturamentoFiltrado]
  )

  const topPerCapita = useMemo(
    () => topOportunidadePerCapitaLimpo(gapsCtx.rows, 24),
    [gapsCtx.rows]
  )
  const topPrioritarias = useMemo(() => topCidadesPrioritarias(cidades, 18), [cidades])
  const topGaps = useMemo(() => topMaioresGaps(gapsCtx.rows, 18), [gapsCtx.rows])

  const litrosItems = useMemo(
    () =>
      [...perCapita]
        .filter((c) => c.volume_per_capita != null)
        .sort((a, b) => (b.volume_per_capita ?? 0) - (a.volume_per_capita ?? 0))
        .slice(0, 18),
    [perCapita]
  )

  const gapOf = (cidade: string, estado: string) => lookupCidadeGap(gapsCtx, cidade, estado)

  if (cidades.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        Nenhuma cidade no filtro atual.
      </p>
    )
  }

  return (
    <div className="space-y-5 mb-6">
      <InsightsCallout>
        <p>
          As <strong>top 3</strong> cidades concentram{' '}
          <strong>{formatPercent(concentracao.top3)}</strong> do faturamento filtrado; as{' '}
          <strong>top 5</strong>, <strong>{formatPercent(concentracao.top5)}</strong>.
          {concentracao.leaderUf ? (
            <>
              {' '}
              <strong>{concentracao.leaderUf}</strong> lidera com{' '}
              <strong>{formatPercent(concentracao.leaderShare)}</strong> do total.
            </>
          ) : null}
        </p>
      </InsightsCallout>

      {historicoData.length > 0 && (
        <InsightsChartCard
          title="Comparativo de sell-out · histórico"
          description="Vida toda do histórico Arruda no Nordeste — leitura plena, sem recorte de mês"
          height="auto"
        >
          <InsightsHistoricoChart
            data={historicoData}
            seriesLabel="Sell-out Nordeste"
            barHeightClass="h-24"
          />
        </InsightsChartCard>
      )}

      {gapsCtx.benchmark ? (
        <p className="text-xs text-muted-foreground">
          Potencial: referência{' '}
          <span className="font-medium text-foreground tabular-nums">
            {formatPerCapitaCurrency(gapsCtx.benchmark.faturamento_per_capita)}/hab
          </span>{' '}
          ({describeBenchmarkRule(gapsCtx.benchmark)}). Ajuste clientes na engrenagem
          Parametrização.
        </p>
      ) : null}

      {popQ.isPending ? (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-border/60 py-12 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando população IBGE…
        </div>
      ) : (
        <TopAcionaveis
          eyebrow="Oportunidade per capita"
          description={`${perCapita.length} municípios · ranking com fat./hab limpo (sem clientes da Parametrização) · total histórico aparece abaixo quando houver exclusão`}
          columns={3}
          items={topPerCapita}
          getKey={(c) => `${c.cidade}-${c.estado}`}
          onItemClick={(c) => onOpenCidade?.(c.cidade, c.estado)}
          renderItem={(c) => <CidadeOppItem c={c} />}
        />
      )}

      {topGaps.length > 0 && (
        <TopAcionaveis
          eyebrow="Maiores gaps · potencial"
          description={
            gapsCtx.benchmark
              ? `vs. ${formatPerCapitaCurrency(gapsCtx.benchmark.faturamento_per_capita)}/hab · ${gapsCtx.benchmark.excluded_clientes} cliente(s) fora do potencial`
              : 'Gap vs. referência de potencial'
          }
          columns={3}
          items={topGaps}
          getKey={(c) => `${c.cidade}-${c.estado}-gap`}
          onItemClick={(c) => onOpenCidade?.(c.cidade, c.estado)}
          renderItem={(c) => <CidadeGapItem c={c} />}
        />
      )}

      <TopAcionaveis
        eyebrow="Mercados prioritários"
        description="Faturamento × penetração de clientes · 18 cidades · clique para abrir clientes da cidade"
        columns={3}
        items={topPrioritarias}
        getKey={(c) => `${c.cidade}-${c.estado}`}
        onItemClick={(c) => onOpenCidade?.(c.cidade, c.estado)}
        renderItem={(c) => {
          const pc = perCapita.find((p) => p.cidade === c.cidade && p.estado === c.estado)
          const gap = gapOf(c.cidade, c.estado)
          return (
            <div>
              <div className="flex items-start justify-between gap-2">
                <p className={insightsListTitleClass}>
                  {c.cidade}{' '}
                  <span className="text-[10px] uppercase text-muted-foreground">{c.estado}</span>
                </p>
                <InsightsGapStatus gap={gap} className="shrink-0" />
              </div>
              <p className={insightsListMetaClass}>
                {formatCurrency(c.faturamento_total)} · {c.total_clientes} clientes
                {pc ? (
                  <>
                    <span className="mx-1 opacity-40">·</span>
                    <span className="text-teal font-medium">
                      {formatPerCapitaCurrency(pc.faturamento_per_capita)}/hab
                    </span>
                  </>
                ) : null}
              </p>
            </div>
          )
        }}
      />

      {litrosItems.length > 0 && (
        <TopAcionaveis
          eyebrow="Volume per capita · litros"
          description="Cidades com unidade predominante em litro"
          columns={3}
          items={litrosItems}
          getKey={(c) => `${c.cidade}-${c.estado}-L`}
          onItemClick={(c) => onOpenCidade?.(c.cidade, c.estado)}
          renderItem={(c) => (
            <div>
              <p className={insightsListTitleClass}>
                {c.cidade}{' '}
                <span className="text-[10px] uppercase text-muted-foreground">{c.estado}</span>
              </p>
              <p className={insightsListMetaClass}>
                <span className="text-teal font-semibold">
                  {formatVolumePerCapita(c.volume_per_capita!, c.unidade_volume)}
                </span>
                <span className="mx-1 opacity-40">·</span>
                {formatCurrency(c.faturamento_total)}
              </p>
            </div>
          )}
        />
      )}

      {!popQ.isPending && perCapita.length > 0 && (
        <p className="text-[11px] text-muted-foreground/80 flex flex-wrap items-center gap-1.5">
          <TrendingUp className="h-3 w-3 shrink-0" />
          Ranking e status usam fat./hab limpo (sem clientes da Parametrização). Total
          histórico só aparece como linha auxiliar quando há exclusão
          {gapsCtx.benchmark ? <> · {describeBenchmarkRule(gapsCtx.benchmark)}</> : '.'}
          <Users className="h-3 w-3 ml-1 inline shrink-0" />
          {perCapita.length}/{cidades.length} cidades com população resolvida.
        </p>
      )}
    </div>
  )
}

function CidadeOppItem({ c }: { c: CidadeGapPerCapita }) {
  return (
    <div>
      <div className="flex items-start justify-between gap-2">
        <p className={insightsListTitleClass}>
          {c.cidade}{' '}
          <span className="text-[10px] uppercase text-muted-foreground">{c.estado}</span>
        </p>
        <InsightsGapStatus gap={c} className="shrink-0" />
      </div>
      <p className={insightsListMetaClass}>
        <span className="text-teal font-semibold">
          {formatPerCapitaCurrency(c.faturamento_per_capita_limpo)}/hab limpo
        </span>
        <span className="mx-1 opacity-40">·</span>
        {formatCurrency(c.faturamento_limpo)}
        <span className="mx-1 opacity-40">·</span>
        {c.total_clientes_limpos} cli
        <span className="mx-1 opacity-40">·</span>
        {c.populacao.toLocaleString('pt-BR')} hab
      </p>
      {c.tem_exclusao ? (
        <p className="mt-0.5 text-[10px] tabular-nums text-muted-foreground/80">
          total histórico {formatPerCapitaCurrency(c.faturamento_per_capita)}/hab ·{' '}
          {formatCurrency(c.faturamento_total)}
        </p>
      ) : null}
    </div>
  )
}

function CidadeGapItem({ c }: { c: CidadeGapPerCapita }) {
  return (
    <div>
      <div className="flex items-start justify-between gap-2">
        <p className={insightsListTitleClass}>
          {c.cidade}{' '}
          <span className="text-[10px] uppercase text-muted-foreground">{c.estado}</span>
        </p>
        <InsightsGapStatus gap={c} className="shrink-0" />
      </div>
      <p className={insightsListMetaClass}>
        <span className="font-semibold text-foreground">
          {formatCurrency(c.gap_faturamento)}
        </span>
        <span className="mx-1 opacity-40">de gap</span>
        <span className="mx-1 opacity-40">·</span>
        {formatAtingidoPct(c.atingido_pct)} da ref.
        <span className="mx-1 opacity-40">·</span>
        {formatPerCapitaCurrency(c.faturamento_per_capita_limpo)}/hab limpo
      </p>
    </div>
  )
}
