import { useMemo, useEffect, useState, type MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  CalendarClock,
  DollarSign,
  FileSpreadsheet,
  FileText,
  Receipt,
  Repeat,
  XIcon,
  Package,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { ClienteDistribuidor } from '@/types/distribuidor'
import { useFaturamento, useClienteMensalCompleto, useFaturamentoItensBatch } from '@/hooks/useFaturamento'
import { useClienteMixLocal } from '@/hooks/useClienteMixLocal'
import { useDistribuidorProdutoDePara } from '@/hooks/useDistribuidorProdutoDePara'
import { useProdutos } from '@/hooks/useProdutos'
import { monthEnd, monthStart } from '@/lib/periodo'
import {
  buildDeParaMap,
  buildProdutoDescricaoMap,
  enrichMixComDePara,
  enrichFaturamentoItens,
} from '@/lib/produto-depara-display'
import { formatCurrency, formatDate } from '@/lib/format'
import { downloadXlsxMulti } from '@/lib/exportTableXlsx'
import { downloadPdfReport } from '@/lib/exportPdfReport'
import { formatAnoMesLabel } from '@/lib/insights-sinalizadores'
import type { MetricaAnalise } from '@/lib/metrica-analise'
import { computeHighlightMonths } from '@/lib/insights-highlight-months'
import { MetricaToggle } from '@/components/distribuidor/MetricaToggle'
import { InsightsHistoricoChart } from '@/components/insights/InsightsHistoricoChart'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/distribuidor/StatusBadge'
import { InsightsBadge } from '@/components/insights/InsightsBadge'
import { ClienteSinalizadores } from '@/components/cliente/ClienteSinalizadores'
import { ClienteResumoNfTable } from '@/components/cliente/ClienteResumoNfTable'
import {
  buildClienteFatResumoFromFaturamentos,
} from '@/lib/cliente-faturamento-resumo'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface Props {
  clienteId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  periodo?: { inicio: string; fim: string }
  metrica?: MetricaAnalise
  distribuidorId?: string
}

function useCliente(id: string | null) {
  return useQuery({
    queryKey: ['cliente-detalhe', id],
    queryFn: async () => {
      if (!id) throw new Error('id required')
      const { data, error } = await supabase
        .from('alwayson_clientes_distribuidor')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      return data as ClienteDistribuidor
    },
    enabled: !!id,
  })
}

function useVendedorNome(vendedorId: string | undefined) {
  return useQuery({
    queryKey: ['vendedor-nome', vendedorId],
    queryFn: async () => {
      if (!vendedorId) throw new Error('vendedorId required')
      const { data, error } = await supabase
        .from('alwayson_vendedores_distribuidor')
        .select('nome')
        .eq('id', vendedorId)
        .single()
      if (error) throw error
      return data.nome as string
    },
    enabled: !!vendedorId,
  })
}

function stopRowClick(e: MouseEvent) {
  e.preventDefault()
  e.stopPropagation()
}

export function ClienteResumoModal({
  clienteId,
  open,
  onOpenChange,
  periodo,
  metrica: metricaProp = 'faturamento',
  distribuidorId,
}: Props) {
  const navigate = useNavigate()
  const [metrica, setMetrica] = useState<MetricaAnalise>(metricaProp)

  useEffect(() => {
    if (open) setMetrica(metricaProp)
  }, [open, metricaProp])

  const { data: cliente, isLoading: loadingCliente } = useCliente(clienteId)
  const { data: faturamentos, isLoading: loadingFat } = useFaturamento(clienteId ?? undefined)
  const { data: mensal, isLoading: loadingMensal } = useClienteMensalCompleto(
    clienteId ?? undefined
  )
  const { data: vendedorNome } = useVendedorNome(cliente?.vendedor_id)
  const { data: mixProdutos = [], isLoading: loadingMix } = useClienteMixLocal(
    cliente?.cnpj,
    open && !!cliente,
    periodo
  )
  const { data: deParaLocal = [] } = useDistribuidorProdutoDePara(
    open ? distribuidorId : undefined
  )
  const { data: produtosCatalogo = [] } = useProdutos()

  const deParaMap = useMemo(() => buildDeParaMap(deParaLocal), [deParaLocal])
  const descricoesMap = useMemo(
    () => buildProdutoDescricaoMap(produtosCatalogo),
    [produtosCatalogo]
  )

  const mixEnriquecido = useMemo(
    () => enrichMixComDePara(mixProdutos, deParaMap, descricoesMap),
    [mixProdutos, deParaMap, descricoesMap]
  )

  const mixVisivel = mixEnriquecido.slice(0, 12)

  const kpis = useMemo(() => {
    if (!faturamentos) return null
    const total = faturamentos.reduce((sum, f) => sum + f.valor_total, 0)
    const count = faturamentos.length
    const ticketMedio = count > 0 ? total / count : 0

    let freqCompra = 0
    if (count > 1) {
      const dates = faturamentos
        .map((f) => new Date(f.data_emissao).getTime())
        .sort((a, b) => a - b)
      const spanMs = dates[dates.length - 1] - dates[0]
      const spanMonths = spanMs / (1000 * 60 * 60 * 24 * 30)
      freqCompra = spanMonths > 0 ? count / spanMonths : count
    } else {
      freqCompra = count
    }

    return { total, ticketMedio, freqCompra }
  }, [faturamentos])

  const faturamentosPeriodo = useMemo(() => {
    if (!faturamentos || !periodo) return faturamentos ?? []
    return faturamentos.filter(
      (f) =>
        f.data_emissao >= monthStart(periodo.inicio) &&
        f.data_emissao <= monthEnd(periodo.fim)
    )
  }, [faturamentos, periodo])

  const recentNfs = faturamentos?.slice(0, 5) ?? []
  const nfsExibidas = periodo ? faturamentosPeriodo : recentNfs
  const nfsIds = useMemo(() => nfsExibidas.map((f) => f.id), [nfsExibidas])

  const { data: itensBatch, isLoading: loadingItens } = useFaturamentoItensBatch(
    nfsIds,
    open && nfsIds.length > 0
  )

  const itensByNf = useMemo(() => {
    const out = new Map<string, ReturnType<typeof enrichFaturamentoItens>>()
    if (!itensBatch) return out
    for (const [fatId, itens] of itensBatch) {
      out.set(fatId, enrichFaturamentoItens(itens, deParaMap, descricoesMap))
    }
    return out
  }, [itensBatch, deParaMap, descricoesMap])

  const resumoFat = useMemo(
    () =>
      faturamentos
        ? buildClienteFatResumoFromFaturamentos(faturamentos, periodo)
        : undefined,
    [faturamentos, periodo]
  )
  const nomeExibicao = cliente?.nome_fantasia || cliente?.razao_social || 'Cliente'

  const kpisPeriodo = useMemo(() => {
    const rows = periodo ? faturamentosPeriodo : faturamentos
    if (!rows?.length) return null
    const total = rows.reduce((sum, f) => sum + f.valor_total, 0)
    const count = rows.length
    return { total, ticketMedio: count > 0 ? total / count : 0, count }
  }, [faturamentos, faturamentosPeriodo, periodo])

  const chartData = useMemo(
    () =>
      (mensal ?? []).map((m) => ({
        month: m.month,
        total: metrica === 'faturamento' ? m.faturamento : m.quantidade,
      })),
    [mensal, metrica]
  )

  const highlightMonths = useMemo(
    () =>
      periodo
        ? computeHighlightMonths(periodo, chartData.map((d) => d.month))
        : new Set<string>(),
    [periodo, chartData]
  )

  function exportResumo(e: MouseEvent) {
    stopRowClick(e)
    const nfs = periodo ? faturamentosPeriodo : (faturamentos ?? []).slice(0, 25)
    downloadXlsxMulti(`cliente-${cliente?.cnpj?.slice(0, 8) ?? 'resumo'}.xlsx`, [
      {
        name: 'NFs',
        rows: nfs.map((f) => ({
          Data: f.data_emissao,
          NF: f.numero_nf,
          'Valor R$': f.valor_total,
        })),
      },
      {
        name: 'Itens por NF',
        rows: nfs.flatMap((f) => {
          const itens = itensByNf.get(f.id) ?? []
          return itens.map((item) => ({
            NF: f.numero_nf,
            Data: f.data_emissao,
            SKU: item.sku,
            Produto: item.descricao,
            Qtd: item.quantidade,
            'Valor R$': item.valor_total,
          }))
        }),
      },
      {
        name: 'Mix agregado',
        rows: mixEnriquecido.map((p) => ({
          SKU: p.sku,
          Produto: p.descricao,
          Qtd: p.quantidade_total,
          'Faturamento R$': p.faturamento_total,
        })),
      },
    ])
  }

  function exportResumoPdf(e: MouseEvent) {
    stopRowClick(e)
    if (!cliente) return
    const nfs = periodo ? faturamentosPeriodo : (faturamentos ?? []).slice(0, 25)
    const periodoLabel = periodo
      ? `${formatAnoMesLabel(periodo.inicio)} – ${formatAnoMesLabel(periodo.fim)}`
      : 'Acumulado'

    downloadPdfReport({
      filename: `cliente-${cliente.cnpj.slice(0, 8)}.pdf`,
      title: 'Resumo do cliente · Performance',
      subtitle: nomeExibicao,
      meta: [
        { label: 'CNPJ', value: cliente.cnpj },
        { label: 'Local', value: `${cliente.cidade}/${cliente.estado}` },
        { label: 'Período', value: periodoLabel },
        {
          label: 'Faturamento',
          value: kpisPeriodo ? formatCurrency(kpisPeriodo.total) : '—',
        },
        {
          label: 'Ticket médio',
          value: kpisPeriodo ? formatCurrency(kpisPeriodo.ticketMedio) : '—',
        },
        {
          label: 'NFs',
          value: kpisPeriodo ? String(kpisPeriodo.count) : '—',
        },
        {
          label: 'Última compra',
          value: resumoFat?.ultimaCompra ? formatDate(resumoFat.ultimaCompra) : '—',
        },
        {
          label: 'Métrica evolução',
          value: metrica === 'faturamento' ? 'Faturamento (R$)' : 'Unidade',
        },
      ],
      sections: [
        {
          title: 'Evolução sell-in (mensal)',
          head: ['Mês', metrica === 'faturamento' ? 'Faturamento' : 'Quantidade'],
          body: chartData.map((d) => [
            formatAnoMesLabel(d.month),
            metrica === 'faturamento' ? formatCurrency(d.total) : String(d.total),
          ]),
        },
        {
          title: periodo ? 'NFs do período' : 'NFs recentes',
          head: ['Data', 'NF', 'Valor R$'],
          body: nfs.map((f) => [
            formatDate(f.data_emissao),
            f.numero_nf,
            formatCurrency(f.valor_total),
          ]),
        },
        ...(mixEnriquecido.length > 0
          ? [
              {
                title: periodo ? 'Mix do período (agregado)' : 'Mix agregado',
                head: ['SKU', 'Descrição', 'Qtd', 'Faturamento R$'],
                body: mixEnriquecido.map((p) => [
                  p.sku,
                  p.descricao,
                  String(p.quantidade_total),
                  formatCurrency(p.faturamento_total),
                ]),
              },
            ]
          : []),
        ...nfs.map((f) => {
          const itens = itensByNf.get(f.id) ?? []
          if (itens.length === 0) return null
          return {
            title: `NF ${f.numero_nf} · ${formatDate(f.data_emissao)}`,
            head: ['SKU', 'Descrição', 'Qtd', 'Valor R$'],
            body: itens.map((item) => [
              item.sku,
              item.descricao,
              String(item.quantidade),
              formatCurrency(item.valor_total),
            ]),
          }
        }).filter(Boolean) as { title: string; head: string[]; body: string[][] }[],
      ],
      footer: 'Relatório gerado a partir do sell-in ingerido pelo distribuidor (AlwaysOn).',
    })
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
          onClick={(e) => {
            stopRowClick(e)
            onOpenChange(false)
          }}
          className="absolute top-2 right-2 z-10 inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <XIcon className="size-4" />
        </button>

        <div className="overflow-y-auto px-4 pt-4 pb-2">
          <DialogHeader className="gap-2 pr-8 text-left">
            {loadingCliente ? (
              <>
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-64" />
              </>
            ) : cliente ? (
              <>
                <DialogTitle className="flex items-start gap-2 text-base leading-snug">
                  <span className="flex-1">{nomeExibicao}</span>
                  <InsightsBadge
                    cnpj={cliente.cnpj}
                    faturamentoLocal={kpisPeriodo?.total ?? kpis?.total ?? null}
                    nfsLocais={kpisPeriodo?.count ?? faturamentos?.length ?? null}
                    periodoAnalise={periodo}
                    distribuidorId={distribuidorId}
                    metrica={metrica}
                  />
                </DialogTitle>
                <DialogDescription className="text-left">
                  <p className="font-mono text-xs text-muted-foreground">{cliente.cnpj}</p>
                  <p className="text-sm text-muted-foreground">
                    {cliente.cidade}/{cliente.estado}
                    {vendedorNome && (
                      <>
                        {' '}
                        · Vendedor {vendedorNome}
                      </>
                    )}
                  </p>
                  <StatusBadge status={cliente.status} />
                  <ClienteSinalizadores
                    cliente={cliente}
                    resumo={resumoFat}
                    className="mt-1"
                  />
                </DialogDescription>
              </>
            ) : (
              <DialogTitle>Cliente não encontrado</DialogTitle>
            )}
          </DialogHeader>

          {cliente && (
            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <MetricaToggle value={metrica} onChange={setMetrica} size="sm" />
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-[10px]"
                    onMouseDown={stopRowClick}
                    onClick={exportResumoPdf}
                  >
                    <FileText className="mr-1 size-3" />
                    PDF
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-[10px]"
                    onMouseDown={stopRowClick}
                    onClick={exportResumo}
                  >
                    <FileSpreadsheet className="mr-1 size-3" />
                    Excel
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <KpiMini
                  icon={DollarSign}
                  label={periodo ? 'Faturamento (período)' : 'Faturamento'}
                  value={
                    kpisPeriodo
                      ? formatCurrency(kpisPeriodo.total)
                      : kpis
                        ? formatCurrency(kpis.total)
                        : '—'
                  }
                  loading={loadingFat}
                />
                <KpiMini
                  icon={Receipt}
                  label="Ticket médio"
                  value={
                    kpisPeriodo
                      ? formatCurrency(kpisPeriodo.ticketMedio)
                      : kpis
                        ? formatCurrency(kpis.ticketMedio)
                        : '—'
                  }
                  loading={loadingFat}
                />
                <KpiMini
                  icon={Repeat}
                  label="Freq. compra"
                  value={kpis ? `${kpis.freqCompra.toFixed(1)}/mês` : '—'}
                  loading={loadingFat}
                />
                <KpiMini
                  icon={CalendarClock}
                  label="Última compra"
                  value={resumoFat?.ultimaCompra ? formatDate(resumoFat.ultimaCompra) : '—'}
                  loading={loadingFat}
                />
              </div>

              <section>
                <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Evolução · sell-in
                </h3>
                {loadingMensal ? (
                  <div className="space-y-1.5">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-4 w-full" />
                    ))}
                  </div>
                ) : (
                  <InsightsHistoricoChart
                    data={chartData}
                    highlightMonths={highlightMonths}
                    metrica={metrica}
                    seriesLabel="Sell-in mensal"
                  />
                )}
              </section>

              <section>
                <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {periodo ? 'NFs do período' : 'Últimas NFs'}
                </h3>
                {loadingFat ? (
                  <Skeleton className="h-24 w-full" />
                ) : (
                  <ClienteResumoNfTable
                    nfs={nfsExibidas}
                    itensByNf={itensByNf}
                    loading={loadingItens}
                  />
                )}
              </section>

              <section>
                <h3 className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  <Package className="size-3" />
                  {periodo ? 'Mix do período' : 'Mix agregado'}
                  {mixEnriquecido.length > 0 && (
                    <span className="font-normal normal-case tracking-normal text-muted-foreground/80">
                      · {mixEnriquecido.length} SKU{mixEnriquecido.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </h3>
                {loadingMix ? (
                  <Skeleton className="h-24 w-full" />
                ) : mixVisivel.length > 0 ? (
                  <div className="max-h-52 overflow-y-auto overflow-x-auto rounded-md border">
                    <Table className="table-fixed w-full min-w-[32rem]">
                      <colgroup>
                        <col className="w-[4.75rem]" />
                        <col />
                        <col className="w-[4.25rem]" />
                        <col className="w-[5.75rem]" />
                      </colgroup>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="h-8 text-xs">SKU</TableHead>
                          <TableHead className="h-8 text-xs">Produto</TableHead>
                          <TableHead className="h-8 text-right text-xs">Qtd</TableHead>
                          <TableHead className="h-8 text-right text-xs">R$</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mixVisivel.map((p) => (
                          <TableRow key={p.sku} className="hover:bg-muted/30">
                            <TableCell className="py-1.5 font-mono text-[10px] truncate">
                              {p.sku}
                            </TableCell>
                            <TableCell className="min-w-0 py-1.5 text-xs break-words leading-snug">
                              {p.descricao}
                            </TableCell>
                            <TableCell className="whitespace-nowrap py-1.5 text-right text-xs tabular-nums">
                              {p.quantidade_total.toLocaleString('pt-BR')}
                            </TableCell>
                            <TableCell className="whitespace-nowrap py-1.5 text-right text-xs tabular-nums">
                              {formatCurrency(p.faturamento_total)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    Nenhum produto no período
                  </p>
                )}
                {mixEnriquecido.length > mixVisivel.length && (
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    +{mixEnriquecido.length - mixVisivel.length} SKU(s) — ver ficha completa
                  </p>
                )}
              </section>
            </div>
          )}
        </div>

        {cliente && (
          <div
            className="flex shrink-0 flex-wrap justify-end gap-2 border-t bg-muted/40 px-4 py-3"
            onMouseDown={stopRowClick}
          >
            <Button
              variant="outline"
              size="sm"
              onMouseDown={stopRowClick}
              onClick={exportResumoPdf}
            >
              <FileText className="mr-1.5 size-3.5" />
              PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              onMouseDown={stopRowClick}
              onClick={exportResumo}
            >
              <FileSpreadsheet className="mr-1.5 size-3.5" />
              Excel
            </Button>
            <Button
              variant="outline"
              onMouseDown={stopRowClick}
              onClick={(e) => {
                stopRowClick(e)
                onOpenChange(false)
              }}
            >
              Fechar
            </Button>
            <Button
              onMouseDown={stopRowClick}
              onClick={(e) => {
                stopRowClick(e)
                onOpenChange(false)
                navigate(`/clientes/${cliente.id}`)
              }}
            >
              Ver ficha completa
              <ArrowRight className="ml-1.5 size-3.5" />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function KpiMini({
  icon: Icon,
  label,
  value,
  loading,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  loading?: boolean
}) {
  return (
    <div className="rounded-md border bg-muted/20 px-2.5 py-2">
      <div className="mb-1 flex items-center gap-1 text-muted-foreground">
        <Icon className="size-3" />
        <span className="text-[9px] font-medium uppercase tracking-wide">{label}</span>
      </div>
      {loading ? (
        <Skeleton className="h-4 w-14" />
      ) : (
        <p className="text-sm font-semibold tabular-nums">{value}</p>
      )}
    </div>
  )
}
