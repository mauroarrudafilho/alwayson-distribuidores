import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ChevronRight, MapPin, Target } from 'lucide-react'
import type { InsightsProdutoDetalhe } from '@/types/insights'
import { formatCurrency } from '@/lib/format'
import { InsightsHistoricoChart } from '@/components/insights/InsightsHistoricoChart'
import { InsightsProdutoUfMap } from '@/components/insights/InsightsProdutoUfMap'
import {
  InsightsProdutoCidadeDrawer,
  type ProdutoCidadeDrawerTarget,
} from '@/components/insights/InsightsProdutoCidadeDrawer'
import { InsightsSortableTh } from '@/components/insights/InsightsSortableTh'
import { useInsightsTableSort } from '@/hooks/useInsightsTableSort'
import { usePagination } from '@/hooks/usePagination'
import { lookupIbgeMeta, useInsightsIbgeMeta } from '@/hooks/useInsightsIbgeMeta'
import { formatPerCapitaCurrency } from '@/lib/insights-per-capita'
import { PaginationBar } from '@/components/ui/pagination-bar'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  InsightsChartCard,
  formatCurrencyCompact,
  formatPercent,
  CHART_AXIS_TICK,
  CHART_GRID_STROKE,
  coerceTooltipNumber,
} from '@/components/insights/charts'

function truncLabel(s: string, max: number) {
  const t = s.trim() || '—'
  return t.length > max ? `${t.slice(0, max - 1)}…` : t
}

function formatPct(pct: number): string {
  if (!Number.isFinite(pct) || pct <= 0) return '—'
  if (pct < 0.1) return '<0,1%'
  return `${pct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
}

const OPORTUNIDADE_MIN_CLIENTES = 8

type CidadeRow = {
  cidade: string
  estado: string
  faturamento_total: number
  total_clientes: number
  pct: number
  fat_por_cliente: number
  populacao: number | null
  fat_per_capita: number | null
  oportunidade: boolean
}

type Props = {
  sku: string
  skuDescricao?: string
  detalhe: InsightsProdutoDetalhe
  fatSku: number
}

export function InsightsProdutoDetalheCharts({
  sku,
  skuDescricao,
  detalhe,
  fatSku,
}: Props) {
  const [ufFiltro, setUfFiltro] = useState('')
  const [drawerTarget, setDrawerTarget] = useState<ProdutoCidadeDrawerTarget | null>(null)

  const estadosCidades = useMemo(
    () => [...new Set(detalhe.topCidades.map((c) => c.estado.trim().toUpperCase()).filter(Boolean))],
    [detalhe.topCidades]
  )
  const ibgeQ = useInsightsIbgeMeta(estadosCidades, detalhe.topCidades.length > 0)

  const histData = useMemo(
    () =>
      detalhe.serieMensal.map((m) => ({
        month: m.ano_mes,
        total: m.faturamento_total,
      })),
    [detalhe.serieMensal]
  )

  const dataCli = useMemo(
    () =>
      detalhe.topClientes.slice(0, 12).map((c) => ({
        name: truncLabel(c.nome_cliente, 22),
        full: `${c.nome_cliente} · ${c.cidade}/${c.estado}`,
        fat: c.faturamento_total,
        pct: fatSku > 0 ? (c.faturamento_total / fatSku) * 100 : 0,
      })),
    [detalhe.topClientes, fatSku]
  )

  const cidadesRows = useMemo((): CidadeRow[] => {
    const byKey = ibgeQ.data?.byKey
    const base = detalhe.topCidades.map((c) => {
      const fat_por_cliente =
        c.total_clientes > 0 ? c.faturamento_total / c.total_clientes : 0
      const meta = lookupIbgeMeta(byKey, c.cidade, c.estado)
      const populacao = meta && meta.populacao > 0 ? meta.populacao : null
      const fat_per_capita =
        populacao != null ? c.faturamento_total / populacao : null
      return {
        cidade: c.cidade,
        estado: c.estado,
        faturamento_total: c.faturamento_total,
        total_clientes: c.total_clientes,
        pct: fatSku > 0 ? (c.faturamento_total / fatSku) * 100 : 0,
        fat_por_cliente,
        populacao,
        fat_per_capita,
        oportunidade: false,
      }
    })

    const elegiveis = base
      .filter((c) => c.total_clientes >= OPORTUNIDADE_MIN_CLIENTES && c.faturamento_total > 0)
      .sort((a, b) => a.fat_por_cliente - b.fat_por_cliente)
    const median =
      elegiveis.length >= 3
        ? (elegiveis[Math.floor(elegiveis.length / 2)]?.fat_por_cliente ?? 0)
        : 0
    const oppKeys = new Set(
      elegiveis
        .filter((c) => median <= 0 || c.fat_por_cliente <= median)
        .map((c) => `${c.cidade}|${c.estado}`)
    )

    return base.map((c) => ({
      ...c,
      oportunidade: oppKeys.has(`${c.cidade}|${c.estado}`),
    }))
  }, [detalhe.topCidades, fatSku, ibgeQ.data?.byKey])

  const cidadesFiltradas = useMemo(() => {
    if (!ufFiltro) return cidadesRows
    return cidadesRows.filter((c) => c.estado.toUpperCase() === ufFiltro.toUpperCase())
  }, [cidadesRows, ufFiltro])

  const cidadeAccessors = useMemo(
    () => ({
      cidade: (r: CidadeRow) => r.cidade,
      estado: (r: CidadeRow) => r.estado,
      fat: (r: CidadeRow) => r.faturamento_total,
      pct: (r: CidadeRow) => r.pct,
      clientes: (r: CidadeRow) => r.total_clientes,
      fpc: (r: CidadeRow) => r.fat_por_cliente,
      populacao: (r: CidadeRow) => r.populacao,
      fatPc: (r: CidadeRow) => r.fat_per_capita,
      oportunidade: (r: CidadeRow) => (r.oportunidade ? 1 : 0),
    }),
    []
  )

  const cidadesSort = useInsightsTableSort(cidadesFiltradas, cidadeAccessors, {
    key: 'fat',
    dir: 'desc',
  })

  const cidadesPag = usePagination({
    items: cidadesSort.sorted,
    initialPageSize: 15,
    resetKey: `${ufFiltro}|${cidadesSort.sort.key}|${cidadesSort.sort.dir}`,
  })

  const nOpp = cidadesFiltradas.filter((c) => c.oportunidade).length

  function openCidade(c: CidadeRow) {
    setDrawerTarget({
      cidade: c.cidade,
      estado: c.estado,
      faturamento_total: c.faturamento_total,
      total_clientes: c.total_clientes,
      populacao: c.populacao,
      fat_per_capita: c.fat_per_capita,
    })
  }

  return (
    <div className="space-y-4">
      <InsightsChartCard
        title="Evolução mensal"
        description="Faturamento do SKU no histórico — lê sazonalidade e tendência"
        height="auto"
      >
        <InsightsHistoricoChart
          data={histData}
          seriesLabel="Sell-out do SKU"
          barHeightClass="h-14"
        />
      </InsightsChartCard>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 xl:items-stretch">
        <InsightsChartCard
          title="Top clientes"
          description="Maiores compradores do item — foco de relacionamento e reposição"
          height={360}
          className="min-w-0"
        >
          {dataCli.length === 0 ? (
            <p className="flex h-full items-center justify-center text-xs text-muted-foreground">
              Sem clientes neste SKU.
            </p>
          ) : (
            <div className="h-full min-h-[320px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={280}>
                <BarChart layout="vertical" data={dataCli} margin={{ left: 2, right: 28, top: 4, bottom: 4 }}>
                  <CartesianGrid stroke={CHART_GRID_STROKE} strokeDasharray="3 3" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={CHART_AXIS_TICK}
                    tickFormatter={(v) => formatCurrencyCompact(v)}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={132}
                    tick={{ ...CHART_AXIS_TICK, fontSize: 10 }}
                    interval={0}
                  />
                  <Tooltip
                    formatter={((v: unknown, _n: unknown, p: { payload?: { pct?: number } }) => {
                      const pct = Number(p?.payload?.pct ?? 0)
                      return [
                        `${formatCurrency(coerceTooltipNumber(v))} (${formatPercent(pct)})`,
                        'Fat.',
                      ]
                    }) as never}
                    labelFormatter={(_, p) => String(p?.[0]?.payload?.full ?? '')}
                    contentStyle={{
                      borderRadius: 8,
                      border: '1px solid var(--color-border)',
                      fontSize: 11,
                    }}
                  />
                  <Bar dataKey="fat" fill="var(--color-primary)" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </InsightsChartCard>

        <InsightsProdutoUfMap
          porUf={detalhe.porUf}
          fatSku={fatSku}
          selectedUf={ufFiltro}
          onSelectUf={setUfFiltro}
          className="min-w-0"
        />
      </div>

      <Card>
        <CardHeader className="space-y-1 pb-2">
          <CardTitle className="flex items-center gap-1.5 text-sm font-semibold">
            <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
            Cidades do SKU
          </CardTitle>
          <p className="text-xs font-normal text-muted-foreground">
            Clique na praça para ver os clientes · rankeie por fat., população ou per capita.
            {ufFiltro ? ` · UF ${ufFiltro}` : ''} ·{' '}
            {cidadesFiltradas.length.toLocaleString('pt-BR')} praças
            {nOpp > 0 && (
              <>
                {' '}
                · {nOpp} com sinal de oportunidade
              </>
            )}
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 text-muted-foreground">#</TableHead>
                <InsightsSortableTh
                  label="Cidade"
                  active={cidadesSort.sort.key === 'cidade'}
                  dir={cidadesSort.sort.dir}
                  onClick={() => cidadesSort.toggle('cidade')}
                />
                <InsightsSortableTh
                  label="UF"
                  active={cidadesSort.sort.key === 'estado'}
                  dir={cidadesSort.sort.dir}
                  onClick={() => cidadesSort.toggle('estado')}
                  className="w-14"
                />
                <InsightsSortableTh
                  label="Faturamento"
                  active={cidadesSort.sort.key === 'fat'}
                  dir={cidadesSort.sort.dir}
                  onClick={() => cidadesSort.toggle('fat')}
                  align="right"
                />
                <InsightsSortableTh
                  label="% SKU"
                  active={cidadesSort.sort.key === 'pct'}
                  dir={cidadesSort.sort.dir}
                  onClick={() => cidadesSort.toggle('pct')}
                  align="right"
                  className="w-16"
                />
                <InsightsSortableTh
                  label="Clientes"
                  active={cidadesSort.sort.key === 'clientes'}
                  dir={cidadesSort.sort.dir}
                  onClick={() => cidadesSort.toggle('clientes')}
                  align="right"
                  className="hidden sm:table-cell w-20"
                />
                <InsightsSortableTh
                  label="População"
                  active={cidadesSort.sort.key === 'populacao'}
                  dir={cidadesSort.sort.dir}
                  onClick={() => cidadesSort.toggle('populacao')}
                  align="right"
                  className="hidden md:table-cell"
                />
                <InsightsSortableTh
                  label="Fat./hab"
                  active={cidadesSort.sort.key === 'fatPc'}
                  dir={cidadesSort.sort.dir}
                  onClick={() => cidadesSort.toggle('fatPc')}
                  align="right"
                  className="hidden lg:table-cell"
                />
                <InsightsSortableTh
                  label="Sinal"
                  active={cidadesSort.sort.key === 'oportunidade'}
                  dir={cidadesSort.sort.dir}
                  onClick={() => cidadesSort.toggle('oportunidade')}
                  className="hidden xl:table-cell w-28"
                />
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {cidadesPag.paginated.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="py-8 text-center text-sm text-muted-foreground">
                    Nenhuma cidade neste filtro.
                  </TableCell>
                </TableRow>
              )}
              {cidadesPag.paginated.map((c, i) => {
                const rank = (cidadesPag.page - 1) * cidadesPag.pageSize + i + 1
                return (
                  <TableRow
                    key={`${c.cidade}-${c.estado}`}
                    className="cursor-pointer"
                    onClick={() => openCidade(c)}
                  >
                    <TableCell className="font-mono text-xs tabular-nums text-muted-foreground">
                      {String(rank).padStart(2, '0')}
                    </TableCell>
                    <TableCell className="max-w-[160px] truncate font-medium">{c.cidade}</TableCell>
                    <TableCell className="text-xs uppercase text-muted-foreground">
                      {c.estado}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(c.faturamento_total)}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums text-teal">
                      {formatPct(c.pct)}
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">
                      {c.total_clientes.toLocaleString('pt-BR')}
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums text-sm md:table-cell">
                      {c.populacao != null ? c.populacao.toLocaleString('pt-BR') : '—'}
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums text-sm text-teal lg:table-cell">
                      {c.fat_per_capita != null
                        ? formatPerCapitaCurrency(c.fat_per_capita)
                        : '—'}
                    </TableCell>
                    <TableCell className="hidden xl:table-cell">
                      {c.oportunidade ? (
                        <Badge
                          variant="outline"
                          className="gap-1 border-amber-500/30 bg-amber-500/10 text-[10px] text-amber-700 dark:text-amber-400"
                          title="Muitos clientes com fat./cliente abaixo da mediana — potencial de upsell"
                        >
                          <Target className="h-2.5 w-2.5" />
                          Oportunidade
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          <div className="border-t border-border/50 px-2 py-2">
            <PaginationBar
              page={cidadesPag.page}
              pageSize={cidadesPag.pageSize}
              total={cidadesPag.total}
              onPageChange={cidadesPag.setPage}
              onPageSizeChange={cidadesPag.setPageSize}
            />
          </div>
        </CardContent>
      </Card>

      <InsightsProdutoCidadeDrawer
        open={!!drawerTarget}
        onOpenChange={(open) => {
          if (!open) setDrawerTarget(null)
        }}
        sku={sku}
        skuDescricao={skuDescricao}
        target={drawerTarget}
      />
    </div>
  )
}
