import { useEffect, useMemo, useState, type MouseEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  ArrowUpDown,
  Check,
  Eye,
  FileSpreadsheet,
  FileText,
  Lightbulb,
  Loader2,
  Minus,
  Package,
  TrendingDown,
  TrendingUp,
  XIcon,
  Archive,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { MetricaToggle } from '@/components/distribuidor/MetricaToggle'
import { ClientTag, ClientTagStack } from '@/components/distribuidor/ClientTag'
import {
  insightsCnpjKey,
  useInsightsClienteHistorico,
  useInsightsClienteMix,
} from '@/hooks/useInsightsQueries'
import { useClienteMixLocal } from '@/hooks/useClienteMixLocal'
import { useDistribuidorProdutoDePara } from '@/hooks/useDistribuidorProdutoDePara'
import { useSkuIndustriaSet } from '@/hooks/useSkuIndustriaSet'
import type { InsightsTopCliente } from '@/types/insights'
import { formatCurrency } from '@/lib/format'
import { downloadXlsx } from '@/lib/exportTableXlsx'
import { downloadPdfReport } from '@/lib/exportPdfReport'
import { formatMetricaValor, type MetricaAnalise } from '@/lib/metrica-analise'
import {
  getCurrentMonth,
  getMonthOffset,
  insightsCicloVivoPeriodo,
  INSIGHTS_CICLO_VIVO_INICIO,
  monthEnd,
  monthStart,
} from '@/lib/periodo'
import { supabase } from '@/lib/supabase'
import { correlacionarMix, sortMixRows, type MixItemStatus } from '@/lib/insights-mix-correlacao'
import {
  buildInsightsSinalizadores,
  formatAnoMesLabel,
  historicoResumo,
} from '@/lib/insights-sinalizadores'
import {
  computeHighlightMonths,
  mesAnaliseNoHistorico,
  mesReferenciaAnalise,
  mesYoYAnterior,
} from '@/lib/insights-highlight-months'
import { InsightsHistoricoChart } from '@/components/insights/InsightsHistoricoChart'
import { InsightsAcaoMenu } from '@/components/insights/InsightsAcaoMenu'
import type { InsightsAcao } from '@/hooks/useInsightsAcoes'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  cliente: InsightsTopCliente
  faturamentoLocal?: number | null
  nfsLocais?: number | null
  /**
   * Período do ciclo vivo (Performance: mês de análise; Insights: ciclo 2025+).
   * Não usar o período fechado do arquivo Arruda (2022–2024).
   */
  periodoAnalise?: { inicio?: string; fim?: string }
  distribuidorId?: string
  metrica?: MetricaAnalise
  /** performance = YoY/destaques; insights = leitura plena do histórico */
  context?: 'performance' | 'insights'
  acao?: InsightsAcao
}

function stopRowClick(e: MouseEvent) {
  e.preventDefault()
  e.stopPropagation()
}

const mixStatusTitle: Record<MixItemStatus, string> = {
  continuidade: 'Continuidade — vendido no histórico e pelo distribuidor',
  historico: 'Só no histórico — produto cadastrado na base Insights, ausente no sell-out atual',
  novo: 'Novo no mix — apenas no sell-out atual do distribuidor',
}

export function InsightsBateOlhoModal({
  open,
  onOpenChange,
  cliente,
  faturamentoLocal,
  nfsLocais,
  periodoAnalise,
  distribuidorId,
  metrica: metricaProp = 'faturamento',
  context = 'performance',
  acao,
}: Props) {
  const navigate = useNavigate()
  const cnpj = cliente.cnpj_cliente
  const isPerformance = context === 'performance'
  const [metrica, setMetrica] = useState<MetricaAnalise>(metricaProp)
  const [mixSortCol, setMixSortCol] = useState<'default' | 'hist' | 'atual'>('default')
  const [mixSortDir, setMixSortDir] = useState<'asc' | 'desc'>('desc')

  useEffect(() => {
    if (open) setMetrica(metricaProp)
  }, [open, metricaProp])

  /** Performance: mês de análise. Insights: jan/2025 → mês vigente. */
  const periodoCicloMes = useMemo(
    () => mesReferenciaAnalise(periodoAnalise) ?? getMonthOffset(2),
    [periodoAnalise]
  )
  const cicloInsights = useMemo(() => {
    if (isPerformance) return null
    const fallback = insightsCicloVivoPeriodo()
    return {
      inicio: periodoAnalise?.inicio ?? fallback.inicio ?? INSIGHTS_CICLO_VIVO_INICIO,
      fim: periodoAnalise?.fim ?? fallback.fim ?? getCurrentMonth(),
    }
  }, [isPerformance, periodoAnalise])

  const mixLocalPeriodo = isPerformance ? periodoCicloMes : (cicloInsights ?? undefined)

  const { data: historico = [], isPending: loadingHist } = useInsightsClienteHistorico(
    open ? cnpj : undefined
  )
  const { data: mix = [], isPending: loadingMix } = useInsightsClienteMix(open ? cnpj : undefined)
  const { data: mixLocal = [], isPending: loadingMixLocal } = useClienteMixLocal(
    cnpj,
    open,
    mixLocalPeriodo
  )
  const { data: deParaLocal = [] } = useDistribuidorProdutoDePara(
    open ? distribuidorId : undefined
  )
  const { skusIndustria } = useSkuIndustriaSet()

  const cnpjKey = insightsCnpjKey(cnpj)
  const fatLocalQ = useQuery({
    queryKey: [
      'insights-bateolho-fat-ciclo',
      cnpjKey,
      isPerformance ? periodoCicloMes : `${cicloInsights?.inicio}_${cicloInsights?.fim}`,
    ],
    enabled: open && !isPerformance && faturamentoLocal == null && cnpjKey.length === 14,
    queryFn: async () => {
      const { data: clientes, error: cErr } = await supabase
        .from('alwayson_clientes_distribuidor')
        .select('id')
        .eq('cnpj', cnpjKey)
      if (cErr) throw cErr
      if (!clientes?.length) return { fat: null as number | null, nfs: null as number | null }

      const ids = clientes.map((c) => c.id as string)
      const inicio = cicloInsights?.inicio ?? INSIGHTS_CICLO_VIVO_INICIO
      const fim = cicloInsights?.fim ?? getCurrentMonth()
      const { data: fats, error: fErr } = await supabase
        .from('alwayson_faturamento')
        .select('valor_total')
        .in('cliente_id', ids)
        .gte('data_emissao', monthStart(inicio))
        .lte('data_emissao', monthEnd(fim))
      if (fErr) throw fErr
      const rows = fats ?? []
      const fat = rows.reduce((s, r) => s + (Number(r.valor_total) || 0), 0)
      return { fat, nfs: rows.length }
    },
  })

  const fatAtual = faturamentoLocal ?? fatLocalQ.data?.fat ?? null
  const nfsAtual = nfsLocais ?? fatLocalQ.data?.nfs ?? null

  const deParaMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const row of deParaLocal) {
      m.set(row.codigo_cliente.trim(), row.sku_fornecedor.trim())
    }
    return m
  }, [deParaLocal])

  const correlacao = useMemo(
    () => correlacionarMix(mix, mixLocal, deParaMap, skusIndustria),
    [mix, mixLocal, deParaMap, skusIndustria]
  )

  const resumo = useMemo(() => historicoResumo(historico), [historico])
  const highlightMonths = useMemo(
    () =>
      isPerformance
        ? computeHighlightMonths(periodoAnalise, historico.map((h) => h.ano_mes))
        : new Set<string>(),
    [isPerformance, periodoAnalise, historico]
  )
  const mesAnalise = useMemo(
    () => (isPerformance ? mesAnaliseNoHistorico(periodoAnalise, historico) : null),
    [isPerformance, periodoAnalise, historico]
  )
  const mesAnaliseRef = isPerformance ? mesReferenciaAnalise(periodoAnalise) : undefined
  const mesAnaliseExato = mesAnaliseRef
    ? historico.some((h) => h.ano_mes === mesAnaliseRef)
    : false
  const mesYoY = mesAnalise ? mesYoYAnterior(mesAnalise.ano_mes, historico) : null

  const variacaoPct = useMemo(() => {
    if (!mesAnalise || !mesYoY || mesYoY.faturamento <= 0) return null
    return ((mesAnalise.faturamento - mesYoY.faturamento) / mesYoY.faturamento) * 100
  }, [mesAnalise, mesYoY])

  const chartData = useMemo(
    () =>
      historico.map((h) => ({
        month: h.ano_mes,
        total: metrica === 'faturamento' ? h.faturamento : h.quantidade_total,
      })),
    [historico, metrica]
  )

  const mixRows = useMemo(
    () => sortMixRows(correlacao.rows, metrica, mixSortCol, mixSortDir),
    [correlacao.rows, metrica, mixSortCol, mixSortDir]
  )

  function toggleMixSort(col: 'hist' | 'atual') {
    if (mixSortCol === col) {
      setMixSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    } else {
      setMixSortCol(col)
      setMixSortDir('desc')
    }
  }

  function exportMixExcel(e: MouseEvent) {
    stopRowClick(e)
    downloadXlsx(
      `insights-mix-${cnpj.slice(0, 8)}.xlsx`,
      'Mix',
      mixRows.map((row) => ({
        SKU: row.sku,
        Descricao: row.descricao,
        Status: row.status,
        'Hist R$': row.fatHistorico ?? '',
        'Atual R$': row.fatLocal ?? '',
        'Hist Un': row.qtdHistorico ?? '',
        'Atual Un': row.qtdLocal ?? '',
      }))
    )
  }

  function exportMixPdf(e: MouseEvent) {
    stopRowClick(e)
    const histLabel = metrica === 'faturamento' ? 'Hist. R$' : 'Hist. Un.'
    const atualLabel = metrica === 'faturamento' ? 'Atual R$' : 'Atual Un.'
    const valorCol = metrica === 'faturamento' ? 'Faturamento' : 'Quantidade'

    const mesesDestaque = chartData
      .filter((d) => highlightMonths.has(d.month))
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((d) => [
        formatAnoMesLabel(d.month),
        metrica === 'faturamento'
          ? formatCurrency(d.total)
          : formatMetricaValor(d.total, 'unidade'),
      ])

    downloadPdfReport({
      filename: `insights-${cnpj.slice(0, 8)}.pdf`,
      title: 'Sell-out Insights · bate olho',
      subtitle: nomeExibicao,
      meta: [
        { label: 'CNPJ', value: cnpj },
        {
          label: 'Local',
          value: `${cliente.cidade ?? '—'}/${cliente.estado ?? '—'}`,
        },
        ...(periodoLabel ? [{ label: 'Período sell-out (ciclo)', value: periodoLabel }] : []),
        {
          label: 'Base histórica',
          value: `${formatCurrency(cliente.faturamento_total)} · ${cliente.total_nfs} NFs · ${cliente.total_skus} SKUs`,
        },
        ...(fatAtual != null
          ? [
              {
                label: 'Sell-out atual',
                value: `${formatCurrency(fatAtual)}${nfsAtual != null ? ` · ${nfsAtual} NFs` : ''}`,
              },
            ]
          : []),
        ...(isPerformance && mesAnaliseRef
          ? [{ label: 'Mês de análise', value: formatAnoMesLabel(mesAnaliseRef) }]
          : []),
        {
          label: 'Mix',
          value: `${correlacao.continuidade} continuidade · ${correlacao.soHistorico} p/ reativar · ${correlacao.soLocal} novos`,
        },
        {
          label: 'Métrica',
          value: metrica === 'faturamento' ? 'Faturamento (R$)' : 'Unidade',
        },
      ],
      sections: [
        ...(mesesDestaque.length > 0
          ? [
              {
                title: 'Meses em destaque (histórico)',
                head: ['Mês', valorCol],
                body: mesesDestaque,
              },
            ]
          : []),
        {
          title: `Correlação de mix · ${mixRows.length} SKUs`,
          head: ['SKU', 'Descrição', 'Status', histLabel, atualLabel],
          body: mixRows.map((row) => [
            row.sku,
            row.descricao,
            row.status === 'continuidade'
              ? 'Continuidade'
              : row.status === 'historico'
                ? 'Só histórico'
                : 'Novo',
            mixCellValue(row, 'hist'),
            mixCellValue(row, 'atual'),
          ]),
        },
      ],
      footer:
        'Base histórica estática (sell-out Arruda) correlacionada com sell-out vivo do distribuidor no ciclo atual. Informativo para oportunidades de mix e reativação.' +
        (correlacao.ignoradosSemDePara > 0
          ? ` ${correlacao.ignoradosSemDePara} SKU(s) sem de-para indústria omitidos.`
          : ''),
    })
  }

  function mixCellValue(row: (typeof mixRows)[0], col: 'hist' | 'atual') {
    if (metrica === 'faturamento') {
      const v = col === 'hist' ? row.fatHistorico : row.fatLocal
      return v != null ? formatCurrency(v) : '—'
    }
    const v = col === 'hist' ? row.qtdHistorico : row.qtdLocal
    return v != null ? formatMetricaValor(v, 'unidade') : '—'
  }

  const sinalizadores = useMemo(
    () => buildInsightsSinalizadores(cliente, historico, mix, correlacao),
    [cliente, historico, mix, correlacao]
  )

  const loading = loadingHist || loadingMix || loadingMixLocal || fatLocalQ.isPending

  const nomeExibicao = (() => {
    const f = cliente.nome_cliente?.trim()
    const r = cliente.razao_social?.trim()
    if (f && f !== '—') return r && r !== f ? `${f} · ${r}` : f
    return r ?? '—'
  })()

  const periodoLabel = cicloInsights
    ? `${formatAnoMesLabel(cicloInsights.inicio)} – ${formatAnoMesLabel(cicloInsights.fim)}`
    : formatAnoMesLabel(periodoCicloMes)

  function fecharDialog(e?: MouseEvent) {
    e?.preventDefault()
    e?.stopPropagation()
    onOpenChange(false)
  }

  function abrirInsights(e: MouseEvent) {
    stopRowClick(e)
    navigate(`/insights?cnpj=${encodeURIComponent(cnpj)}`)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[min(92vh,820px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
        showCloseButton={false}
        onPointerDown={stopRowClick}
      >
        <button
          type="button"
          aria-label="Fechar"
          onMouseDown={stopRowClick}
          onClick={fecharDialog}
          className="absolute top-2 right-2 z-10 inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <XIcon className="size-4" />
        </button>

        <div className="overflow-y-auto px-4 pt-4 pb-2">
          <DialogHeader className="gap-2 pr-8 text-left">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Lightbulb className="size-4 text-amber-500" />
              Sell-out Insights · bate olho
            </DialogTitle>
            <DialogDescription className="text-left">
              <span className="text-foreground">{nomeExibicao}</span>
              <br />
              <span className="font-mono text-xs">{cliente.cnpj_cliente}</span>
              {' · '}
              {cliente.cidade}/{cliente.estado}
            </DialogDescription>
            {sinalizadores.length > 0 && (
              <ClientTagStack className="mt-1">
                {sinalizadores.map((t) => (
                  <ClientTag
                    key={t.id}
                    category={t.category}
                    label={t.label}
                    title={t.title}
                  />
                ))}
              </ClientTagStack>
            )}
            {context === 'insights' && (
              <div className="mt-2">
                <InsightsAcaoMenu cnpj={cliente.cnpj_cliente} acao={acao} prefixLabel="Ação:" />
              </div>
            )}
            <div className="mt-2 flex items-center gap-2">
              <MetricaToggle value={metrica} onChange={setMetrica} size="sm" />
              <span className="text-[10px] text-muted-foreground">
                {metrica === 'unidade' && (
                  <>Soma de quantidades — unidades mistas podem distorcer o total</>
                )}
              </span>
            </div>
          </DialogHeader>

          {loading && (
            <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Carregando histórico e mix…
            </div>
          )}

          <div className="mt-4 space-y-4">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-md border border-dashed bg-muted/10 px-3 py-2.5">
                <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <Archive className="size-3" />
                  Base histórica (Insights)
                </p>
                <p className="text-lg font-semibold tabular-nums">
                  {formatCurrency(cliente.faturamento_total)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {cliente.total_nfs} NFs · {cliente.total_skus} SKUs · fechado
                </p>
              </div>
              <div className="rounded-md border bg-muted/20 px-3 py-2.5">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Sell-out atual · {periodoLabel}
                </p>
                <p className="text-lg font-semibold tabular-nums">
                  {fatAtual != null ? formatCurrency(fatAtual) : '—'}
                </p>
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span
                    className="inline-flex items-center gap-1 rounded-md border border-teal/25 bg-teal/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal"
                    title={
                      cicloInsights
                        ? 'Ciclo vivo do distribuidor · jan/25 → mês vigente'
                        : 'Ciclo vivo do distribuidor'
                    }
                  >
                    <span className="relative flex size-1.5">
                      <span className="absolute inline-flex size-full animate-ping rounded-full bg-teal opacity-60" />
                      <span className="relative inline-flex size-1.5 rounded-full bg-teal" />
                    </span>
                    Live
                  </span>
                  <span className="tabular-nums">
                    {nfsAtual != null ? `${nfsAtual} NFs` : '—'}
                  </span>
                </p>
              </div>
            </div>

            {isPerformance && (mesAnalise || mesAnaliseRef) && (
              <div className="rounded-md border border-amber-500/35 bg-amber-500/8 px-3 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                      Mês de análise
                      {mesAnaliseRef ? ` · ${formatAnoMesLabel(mesAnaliseRef)}` : ''}
                    </p>
                    {mesAnalise ? (
                      <>
                        <p className="mt-0.5 text-xl font-semibold tabular-nums">
                          {metrica === 'faturamento'
                            ? formatCurrency(mesAnalise.faturamento)
                            : formatMetricaValor(mesAnalise.quantidade_total, 'unidade')}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {mesAnalise.total_nfs} NF{mesAnalise.total_nfs === 1 ? '' : 's'} ·{' '}
                          {mesAnalise.total_skus} SKUs ·{' '}
                          {mesAnalise.quantidade_total.toLocaleString('pt-BR')} un
                          {!mesAnaliseExato && mesAnaliseRef && (
                            <> · último {formatAnoMesLabel(mesAnalise.ano_mes)} no histórico</>
                          )}
                        </p>
                      </>
                    ) : (
                      <p className="mt-1 text-sm text-muted-foreground">
                        Sem registro histórico para este mês — comparando meses equivalentes abaixo.
                      </p>
                    )}
                  </div>
                  {variacaoPct != null && mesYoY && (
                    <div className="text-right">
                      <VariacaoBadge pct={variacaoPct} />
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        vs {formatAnoMesLabel(mesYoY.ano_mes)}
                      </p>
                    </div>
                  )}
                </div>
                {resumo.pico && (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Pico histórico: {formatAnoMesLabel(resumo.pico.ano_mes)} (
                    {formatCurrency(resumo.pico.faturamento)}) · Média/mês:{' '}
                    {formatCurrency(resumo.media)}
                  </p>
                )}
              </div>
            )}

            {!isPerformance && resumo.pico && (
              <p className="text-[11px] text-muted-foreground">
                Pico histórico: {formatAnoMesLabel(resumo.pico.ano_mes)} (
                {formatCurrency(resumo.pico.faturamento)}) · Média/mês:{' '}
                {formatCurrency(resumo.media)}
              </p>
            )}

            <section>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Evolução · vida toda do histórico
                {isPerformance && highlightMonths.size > 0 && (
                  <span className="ml-1 normal-case tracking-normal text-muted-foreground/80">
                    (destaque:{' '}
                    {[...highlightMonths].sort().map(formatAnoMesLabel).join(', ')})
                  </span>
                )}
              </p>
              <InsightsHistoricoChart
                data={chartData}
                highlightMonths={isPerformance ? highlightMonths : undefined}
                metrica={metrica}
              />
            </section>

            <section>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  <Package className="size-3.5" />
                  Correlação de mix · histórico × atual
                  {correlacao.rows.length > 0 && (
                    <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] normal-case tracking-normal">
                      {correlacao.rows.length} SKUs
                    </span>
                  )}
                </p>
                <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                  <span>{correlacao.continuidade} continuidade</span>
                  <span>{correlacao.soHistorico} p/ reativar</span>
                  <span>{correlacao.soLocal} novos</span>
                </div>
              </div>

              {correlacao.rows.length === 0 && !loading ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Sem dados de mix para correlacionar
                </p>
              ) : (
                <div className="overflow-hidden rounded-md border">
                  <div className="max-h-[11.5rem] overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 z-[1] bg-muted/95 backdrop-blur-sm">
                        <tr className="border-b text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                          <th className="px-2 py-1.5 font-medium">SKU · Descrição</th>
                          <th className="w-10 px-2 py-1.5 text-center font-medium">St.</th>
                          <th className="px-2 py-1.5 text-right font-medium">
                            <button
                              type="button"
                              className="inline-flex items-center gap-0.5 hover:text-foreground"
                              onClick={() => toggleMixSort('hist')}
                            >
                              Hist.
                              <ArrowUpDown className="size-2.5 opacity-60" />
                            </button>
                          </th>
                          <th className="px-2 py-1.5 text-right font-medium">
                            <button
                              type="button"
                              className="inline-flex items-center gap-0.5 hover:text-foreground"
                              onClick={() => toggleMixSort('atual')}
                            >
                              Atual
                              <ArrowUpDown className="size-2.5 opacity-60" />
                            </button>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {mixRows.map((row) => (
                          <tr key={row.sku} className="border-b border-border/40 last:border-0">
                            <td className="max-w-[200px] px-2 py-1.5">
                              <div className="font-mono text-[11px] font-semibold tabular-nums">
                                {row.sku}
                              </div>
                              <div className="truncate text-[10px] text-muted-foreground">
                                {row.descricao}
                              </div>
                            </td>
                            <td className="w-10 px-2 py-1.5 text-center">
                              <MixStatusIcon status={row.status} />
                            </td>
                            <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                              {mixCellValue(row, 'hist')}
                            </td>
                            <td className="px-2 py-1.5 text-right tabular-nums">
                              {mixCellValue(row, 'atual')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="flex flex-wrap items-center gap-3 border-t px-2 py-1.5 text-[10px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Check className="size-3 text-emerald-600" /> continuidade
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Eye className="size-3 text-amber-500" /> só histórico
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="size-1.5 rounded-full bg-info" /> novo
                    </span>
                  </p>
                </div>
              )}
            </section>

            <p className="text-[11px] text-muted-foreground italic">
              Base histórica estática (sell-out Arruda) correlacionada com sell-out vivo do
              distribuidor no ciclo atual — informativo para oportunidades de mix e reativação.
              {correlacao.ignoradosSemDePara > 0 && (
                <>
                  {' '}
                  {correlacao.ignoradosSemDePara} SKU
                  {correlacao.ignoradosSemDePara === 1 ? '' : 's'} sem de-para indústria{' '}
                  {correlacao.ignoradosSemDePara === 1 ? 'foi omitido' : 'foram omitidos'}.
                </>
              )}
            </p>
          </div>
        </div>

        <div
          className="flex shrink-0 flex-wrap justify-end gap-2 border-t bg-muted/40 px-4 py-3"
          onMouseDown={stopRowClick}
        >
          {mixRows.length > 0 && (
            <>
              <Button variant="outline" size="sm" onMouseDown={stopRowClick} onClick={exportMixPdf}>
                <FileText className="mr-1.5 size-3.5" />
                PDF
              </Button>
              <Button variant="outline" size="sm" onMouseDown={stopRowClick} onClick={exportMixExcel}>
                <FileSpreadsheet className="mr-1.5 size-3.5" />
                Excel
              </Button>
            </>
          )}
          <Button variant="outline" onMouseDown={stopRowClick} onClick={fecharDialog}>
            Fechar
          </Button>
          {context === 'performance' && (
            <Button onMouseDown={stopRowClick} onClick={abrirInsights}>
              Abrir no Insights
              <ArrowRight className="ml-1.5 size-3.5" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function MixStatusIcon({ status }: { status: MixItemStatus }) {
  if (status === 'continuidade') {
    return (
      <span title={mixStatusTitle.continuidade} className="inline-flex justify-center">
        <Check className="size-4 text-emerald-600" aria-label={mixStatusTitle.continuidade} />
      </span>
    )
  }
  if (status === 'historico') {
    return (
      <span title={mixStatusTitle.historico} className="inline-flex justify-center">
        <Eye className="size-4 text-amber-500" aria-label={mixStatusTitle.historico} />
      </span>
    )
  }
  return (
    <span title={mixStatusTitle.novo} className="inline-flex justify-center">
      <span className="size-2 rounded-full bg-info" aria-label={mixStatusTitle.novo} />
    </span>
  )
}

function VariacaoBadge({ pct }: { pct: number }) {
  const abs = Math.abs(pct)
  const label = `${pct > 0 ? '+' : ''}${pct.toFixed(0)}%`
  if (abs < 1) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
        <Minus className="size-3" />
        estável
      </span>
    )
  }
  if (pct > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-emerald-600">
        <TrendingUp className="size-3" />
        {label}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-xs font-medium text-rose-600">
      <TrendingDown className="size-3" />
      {label}
    </span>
  )
}
