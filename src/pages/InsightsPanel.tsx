import { useMemo, useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  DollarSign,
  MapPin,
  Users,
  Receipt,
  Package,
  ChevronRight,
  ChevronDown,
  ArrowLeft,
  ShoppingCart,
  Loader2,
  Archive,
  TrendingDown,
  LineChart as LineChartIcon,
} from 'lucide-react'
import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { PageHeader } from '@/components/distribuidor/PageHeader'
import { KPICard } from '@/components/distribuidor/KPICard'
import { KPIGrid } from '@/components/distribuidor/KPIGrid'
import { SectionTitle } from '@/components/distribuidor/SectionTitle'
import { FilterBar, FilterField } from '@/components/distribuidor/FilterBar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatCurrency } from '@/lib/format'
import type { InsightsCidadeRow, InsightsTopCliente } from '@/types/insights'
import {
  InsightsChartCard,
  formatCurrencyCompact,
  formatInt,
  CHART_AXIS_TICK,
  CHART_GRID_STROKE,
  INSIGHTS_CHART_COLORS,
  coerceTooltipNumber,
} from '@/components/insights/charts'
import { cn } from '@/lib/utils'
import { InsightsAbaProdutos } from '@/components/insights/InsightsAbaProdutos'
import { InsightsClienteBrasilBadge } from '@/components/insights/InsightsClienteBrasilBadge'
import { InsightsClientesCharts } from '@/components/insights/InsightsClientesCharts'
import { InsightsTerritoryCharts } from '@/components/insights/InsightsTerritoryCharts'
import { buildYoySeries } from '@/lib/insights-yoy'
import {
  useInsightsBootstrap,
  useInsightsClienteHistorico,
  useInsightsClienteMix,
  useInsightsMesGlobal,
  insightsCnpjKey,
  formatPeriodoLabel,
} from '@/hooks/useInsightsQueries'
import { usePagination } from '@/hooks/usePagination'
import { PaginationBar } from '@/components/ui/pagination-bar'
import { TopAcionaveis } from '@/components/insights/TopAcionaveis'
import {
  clienteGapMeses,
  topCidadesPrioritarias,
  topClientesPrioritarios,
} from '@/lib/insights-priority'
import {
  useInsightsAcoesByCnpj,
  type InsightsAcaoEstado,
} from '@/hooks/useInsightsAcoes'
import { InsightsAcaoMenu, INSIGHTS_ACAO_LABEL } from '@/components/insights/InsightsAcaoMenu'

function cidadeTerritorioKey(cidade: string | undefined | null, estado: string | undefined | null) {
  const c = (cidade ?? '').trim() || '— sem cidade —'
  const e = (estado ?? '').trim() || '—'
  return `${c}\t${e}`
}

// ─── Subcomponentes ──────────────────────────────────────────────────────────

function MixRow({ row, maxFat }: { row: import('@/types/insights').InsightsClienteMixRow; maxFat: number }) {
  const pct = maxFat > 0 ? (row.faturamento_total / maxFat) * 100 : 0
  return (
    <TableRow>
      <TableCell className="font-mono text-xs">{row.sku}</TableCell>
      <TableCell className="max-w-[180px] truncate">{row.descricao}</TableCell>
      <TableCell className="text-right tabular-nums">
        {row.quantidade_total.toLocaleString('pt-BR')}
        <span className="ml-1 text-muted-foreground text-xs">{row.unidade}</span>
      </TableCell>
      <TableCell className="text-right text-xs text-muted-foreground tabular-nums">{row.meses_ativos}m</TableCell>
      <TableCell className="w-40">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-3 bg-muted/50 rounded overflow-hidden">
            <div className="h-full bg-primary/70 rounded" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs tabular-nums w-20 text-right font-medium">{formatCurrency(row.faturamento_total)}</span>
        </div>
      </TableCell>
    </TableRow>
  )
}

function ClienteDetalheDrawer({
  cliente,
  onClose,
  periodo,
  acao,
}: {
  cliente: InsightsTopCliente
  onClose: () => void
  periodo: { inicio: string; fim: string }
  acao?: import('@/hooks/useInsightsAcoes').InsightsAcao
}) {
  const { data: historico = [], isPending: loadHist } = useInsightsClienteHistorico(cliente.cnpj_cliente)
  const { data: mix = [], isPending: loadMix } = useInsightsClienteMix(cliente.cnpj_cliente)
  const maxFat = Math.max(...(mix.map((m) => m.faturamento_total)), 1)
  const sumNfsMes = historico.reduce((s, h) => s + h.total_nfs, 0)
  const gapMeses = clienteGapMeses(cliente, periodo.fim)
  const anoInicio = periodo.inicio?.slice(0, 4) ?? '—'
  const anoFim = periodo.fim?.slice(0, 4) ?? '—'

  const historicoYoyFat = useMemo(
    () => buildYoySeries(historico, 'faturamento'),
    [historico]
  )
  const historicoYoySkus = useMemo(
    () => buildYoySeries(historico, 'total_skus'),
    [historico]
  )

  const mixPie = useMemo(() => {
    const sorted = [...mix].sort((a, b) => b.faturamento_total - a.faturamento_total)
    const head = sorted.slice(0, 7)
    const tail = sorted.slice(7)
    const outros = tail.reduce((s, r) => s + r.faturamento_total, 0)
    const rows = head.map((r) => {
      const lbl = (r.descricao?.trim() || r.sku) as string
      const short = lbl.length > 18 ? `${lbl.slice(0, 17)}…` : lbl
      return {
        name: short,
        full: `${r.descricao?.trim() || '—'} (${r.sku})`,
        value: r.faturamento_total,
      }
    })
    if (outros > 0) {
      rows.push({
        name: `Outros (${tail.length})`,
        full: `${tail.length} SKUs adicionais`,
        value: outros,
      })
    }
    return rows
  }, [mix])

  const totalNfsCliente = cliente.total_nfs
  const totalFaturamento = cliente.faturamento_total
  const maxSkusMes = historico.length > 0 ? Math.max(...historico.map((h) => h.total_skus)) : 0

  return (
    <div className="animate-fade-in">
      <button
        onClick={onClose}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar ao Insights
      </button>

      {(loadHist || loadMix) && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
          <Loader2 className="w-4 h-4 animate-spin" />
          Carregando histórico e mix…
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1">
        <Archive className="w-3.5 h-3.5 text-muted-foreground/70" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
          Histórico Arruda fechado · {anoInicio} – {anoFim}
        </span>
        <span className="text-[11px] text-muted-foreground/60">
          referência estática · sem atualizações neste dataset
        </span>
      </div>

      <div className="mb-4">
        <h2 className="text-base font-semibold text-foreground flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span>
            {(() => {
              const fantasia =
                cliente.nome_cliente && cliente.nome_cliente !== '—'
                  ? cliente.nome_cliente
                  : null
              const razao = cliente.razao_social?.trim()
              if (fantasia) return fantasia
              return razao ?? '—'
            })()}
          </span>
          {cliente.razao_social?.trim() &&
            cliente.nome_cliente &&
            cliente.nome_cliente !== '—' &&
            cliente.razao_social.trim() !== cliente.nome_cliente.trim() && (
              <span className="text-sm font-normal text-muted-foreground">
                · {cliente.razao_social.trim()}
              </span>
            )}
        </h2>
        <p className="text-xs text-muted-foreground font-mono mt-0.5 flex flex-wrap items-center gap-2">
          <span>
            {cliente.cnpj_cliente} · {cliente.cidade}/{cliente.estado}
          </span>
          <InsightsClienteBrasilBadge status={cliente.brasil_enriquecimento_status} />
        </p>
        <div className="mt-2">
          <InsightsAcaoMenu cnpj={cliente.cnpj_cliente} acao={acao} prefixLabel="Ação:" />
        </div>
      </div>

      <KPIGrid columns={4}>
        <KPICard label="Faturamento Total"  value={formatCurrency(totalFaturamento)} icon={DollarSign} />
        <KPICard label="NFs Emitidas"       value={totalNfsCliente}                         icon={Receipt} />
        <KPICard
          label="SKUs no Mix"
          value={mix.length}
          icon={Package}
          badge={`${maxSkusMes} máx/mês`}
        />
        <KPICard
          label="Última Compra"
          value={
            cliente.ultima_compra
              ? new Date(`${cliente.ultima_compra}T12:00:00`).toLocaleDateString('pt-BR')
              : '—'
          }
          icon={gapMeses > 6 ? TrendingDown : ShoppingCart}
          badge={gapMeses > 0 ? `${gapMeses}m antes do fim` : 'até o fim do período'}
        />
      </KPIGrid>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
        <InsightsChartCard
          title="Faturamento mensal · ano-sobre-ano"
          description={`Jan–Dez · uma linha por ano · janela Arruda ${anoInicio}–${anoFim}`}
          height={268}
        >
          {historico.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Sem histórico disponível.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={historicoYoyFat.data} margin={{ left: 4, right: 8, top: 8 }}>
                <CartesianGrid stroke={CHART_GRID_STROKE} strokeDasharray="3 3" />
                <XAxis dataKey="mes" tick={CHART_AXIS_TICK} interval={0} />
                <YAxis
                  tick={CHART_AXIS_TICK}
                  tickFormatter={(v: number) => formatCurrencyCompact(v)}
                />
                <Tooltip
                  formatter={((value: unknown) =>
                    formatCurrency(coerceTooltipNumber(value))
                  ) as never}
                  contentStyle={{
                    borderRadius: 8,
                    border: '1px solid var(--color-border)',
                    fontSize: 12,
                  }}
                />
                <Legend
                  iconType="circle"
                  wrapperStyle={{ fontSize: 11, paddingTop: 4 }}
                  formatter={(value) => (
                    <span className="text-xs text-muted-foreground">{value}</span>
                  )}
                />
                {historicoYoyFat.years.map((year, idx) => (
                  <Line
                    key={year}
                    type="monotone"
                    dataKey={String(year)}
                    stroke={INSIGHTS_CHART_COLORS[idx % INSIGHTS_CHART_COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name={String(year)}
                    connectNulls={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </InsightsChartCard>

        <InsightsChartCard
          title="SKUs distintos · ano-sobre-ano"
          description="Quantidade de SKUs com venda · uma linha por ano"
        >
          {historico.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Sem dados.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={historicoYoySkus.data} margin={{ left: 4, right: 8, top: 8 }}>
                <CartesianGrid stroke={CHART_GRID_STROKE} strokeDasharray="3 3" />
                <XAxis dataKey="mes" tick={CHART_AXIS_TICK} interval={0} />
                <YAxis tick={CHART_AXIS_TICK} allowDecimals={false} />
                <Tooltip
                  formatter={((value: unknown) => formatInt(coerceTooltipNumber(value))) as never}
                  contentStyle={{
                    borderRadius: 8,
                    border: '1px solid var(--color-border)',
                    fontSize: 12,
                  }}
                />
                <Legend
                  iconType="circle"
                  wrapperStyle={{ fontSize: 11, paddingTop: 4 }}
                  formatter={(value) => (
                    <span className="text-xs text-muted-foreground">{value}</span>
                  )}
                />
                {historicoYoySkus.years.map((year, idx) => (
                  <Line
                    key={year}
                    type="monotone"
                    dataKey={String(year)}
                    stroke={INSIGHTS_CHART_COLORS[idx % INSIGHTS_CHART_COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name={String(year)}
                    connectNulls={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </InsightsChartCard>
      </div>

      {historico.length > 0 && sumNfsMes !== totalNfsCliente && (
        <p className="text-[11px] text-amber-700 dark:text-amber-500 mt-4">
          Soma de NFs nos meses ({sumNfsMes}) difere do total do cliente ({totalNfsCliente}). Pode haver datas
          incorretas na carga ou NFs fora do período agregado.
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
        <InsightsChartCard title="Participação no mix — faturamento" description="Até 7 SKUs · demais agrupados">
          {mix.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Sem itens para o gráfico.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={mixPie}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={86}
                  paddingAngle={1}
                >
                  {mixPie.map((_, i) => (
                    <Cell key={`${mixPie[i].name}-${i}`} fill={INSIGHTS_CHART_COLORS[i % INSIGHTS_CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={((v: unknown) => formatCurrency(coerceTooltipNumber(v))) as never}
                  labelFormatter={(_, payload) => String(payload?.[0]?.payload?.full ?? '')}
                  contentStyle={{
                    borderRadius: 8,
                    border: '1px solid var(--color-border)',
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </InsightsChartCard>

        <Card className="border-border/70">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Package className="w-4 h-4 text-muted-foreground" />
              Mix cadastrado (detalhe)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {mix.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">Sem itens.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Qtd Total</TableHead>
                    <TableHead className="text-right">Meses</TableHead>
                    <TableHead>Faturamento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mix.map((row) => (
                    <MixRow key={row.sku} row={row} maxFat={maxFat} />
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <section className="mt-6 rounded-md border border-dashed border-border/60 bg-muted/15 px-4 py-3.5">
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
          <LineChartIcon className="w-3.5 h-3.5" />
          Próxima camada · Comparativo com distribuidor atual
        </p>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Quando as vendas do distribuidor para este cliente forem ingeridas, esta área renderiza
          a curva atual sobreposta ao histórico Arruda — destacando o gap entre o fim do período
          fechado ({anoFim}) e hoje.
        </p>
      </section>
    </div>
  )
}

// ─── Visão por cidade ────────────────────────────────────────────────────────

function CidadeRow({
  row,
  maxFat,
  onSelectCliente,
  topClientes,
}: {
  row: InsightsCidadeRow
  maxFat: number
  onSelectCliente: (c: InsightsTopCliente) => void
  topClientes: InsightsTopCliente[]
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <TableRow
        className="cursor-pointer"
        onClick={() => setOpen(!open)}
      >
        <TableCell>
          <span className="flex items-center gap-1.5">
            {open ? (
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            )}
            <span className="font-medium">{row.cidade}</span>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">{row.estado}</Badge>
          </span>
        </TableCell>
        <TableCell className="text-right tabular-nums font-medium">{formatCurrency(row.faturamento_total)}</TableCell>
        <TableCell className="hidden sm:table-cell text-right tabular-nums">{row.total_nfs}</TableCell>
        <TableCell className="hidden md:table-cell text-right tabular-nums">{row.total_clientes}</TableCell>
        <TableCell className="hidden lg:table-cell text-right tabular-nums">{row.total_skus}</TableCell>
        <TableCell className="hidden lg:table-cell">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-3 bg-muted/50 rounded overflow-hidden">
              <div
                className="h-full bg-primary/70 rounded"
                style={{ width: `${(row.faturamento_total / maxFat) * 100}%` }}
              />
            </div>
          </div>
        </TableCell>
      </TableRow>

      {open && (
        <TableRow className="bg-muted/20 hover:bg-muted/20">
          <TableCell colSpan={6} className="p-0">
            <div className="px-8 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Top Clientes — {row.cidade}
              </p>
              <Table>
                <TableHeader>
                  <TableRow className="border-border/30">
                    <TableHead>Cliente</TableHead>
                    <TableHead className="hidden sm:table-cell font-mono text-xs">CNPJ</TableHead>
                    <TableHead className="text-right">Faturamento</TableHead>
                    <TableHead className="hidden md:table-cell text-right">NFs</TableHead>
                    <TableHead className="hidden md:table-cell text-right">SKUs</TableHead>
                    <TableHead className="hidden lg:table-cell text-right">Última Compra</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topClientes.map((c) => (
                    <TableRow
                      key={c.cnpj_cliente}
                      className="cursor-pointer border-border/30"
                      onClick={(e) => {
                        e.stopPropagation()
                        onSelectCliente(c)
                      }}
                    >
                      <TableCell className="font-medium">
                        <span className="flex items-center gap-2 flex-wrap">
                          <span>{c.nome_cliente}</span>
                          <InsightsClienteBrasilBadge status={c.brasil_enriquecimento_status} />
                        </span>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell font-mono text-xs text-muted-foreground">
                        {c.cnpj_cliente}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatCurrency(c.faturamento_total)}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-right tabular-nums">{c.total_nfs}</TableCell>
                      <TableCell className="hidden md:table-cell text-right tabular-nums">{c.total_skus}</TableCell>
                      <TableCell className="hidden lg:table-cell text-right text-xs text-muted-foreground">
                        {c.ultima_compra
                          ? new Date(`${c.ultima_compra}T12:00:00`).toLocaleDateString('pt-BR')
                          : '—'}
                      </TableCell>
                      <TableCell>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ))}
                  {topClientes.length === 0 && (
                    <TableRow className="border-border/30">
                      <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-3">
                        Sem dados de clientes para esta cidade
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

// ─── Página principal ────────────────────────────────────────────────────────

export function InsightsPanel() {
  const boot = useInsightsBootstrap()
  const mesGlobalQ = useInsightsMesGlobal()
  const cidades = boot.data?.cidades ?? []
  const clientes = boot.data?.clientes ?? []
  const kpi = boot.data?.kpiGeral ?? {
    faturamento_total: 0,
    total_cidades: 0,
    total_clientes: 0,
    total_nfs: 0,
    total_skus: 0,
  }
  const periodo = boot.data?.periodo ?? { inicio: '—', fim: '—' }

  const [busca, setBusca] = useState('')
  const [estadoFilter, setEstadoFilter] = useState('')
  const [clienteDetalhe, setClienteDetalhe] = useState<InsightsTopCliente | null>(null)
  const [insightsTab, setInsightsTab] = useState<'territorio' | 'clientes' | 'produtos'>('territorio')
  const [tabBeforeDetail, setTabBeforeDetail] = useState<'territorio' | 'clientes' | 'produtos'>('territorio')
  const [buscaCliente, setBuscaCliente] = useState('')
  const [estadoCliente, setEstadoCliente] = useState('')
  const [acaoFilter, setAcaoFilter] = useState<'todos' | InsightsAcaoEstado>('todos')
  const [searchParams, setSearchParams] = useSearchParams()
  const acoesByCnpj = useInsightsAcoesByCnpj()

  const topPorCidade = useMemo(() => {
    const m = new Map<string, InsightsTopCliente[]>()
    for (const c of clientes) {
      const k = cidadeTerritorioKey(c.cidade, c.estado)
      const arr = m.get(k) ?? []
      arr.push(c)
      m.set(k, arr)
    }
    for (const [, arr] of m) {
      arr.sort((a, b) => b.faturamento_total - a.faturamento_total)
    }
    return m
  }, [clientes])

  // Deep-link: /insights?cnpj=... abre o cliente direto na aba Clientes.
  useEffect(() => {
    const cnpjParam = searchParams.get('cnpj')
    if (!cnpjParam || !boot.data) return

    const target = insightsCnpjKey(cnpjParam)
    if (target.length !== 14) {
      searchParams.delete('cnpj')
      setSearchParams(searchParams, { replace: true })
      return
    }

    const cliente = boot.data.clientes.find((c) => insightsCnpjKey(c.cnpj_cliente) === target)
    if (cliente) {
      setTabBeforeDetail('clientes')
      setClienteDetalhe(cliente)
    }

    searchParams.delete('cnpj')
    setSearchParams(searchParams, { replace: true })
  }, [searchParams, setSearchParams, boot.data])

  const openClienteDetalhe = (c: InsightsTopCliente) => {
    setTabBeforeDetail(insightsTab)
    setClienteDetalhe(c)
  }

  const cidadesFiltradas = useMemo(() => {
    return cidades.filter((c) => {
      const matchBusca =
        busca === '' ||
        c.cidade.toLowerCase().includes(busca.toLowerCase()) ||
        c.estado.toLowerCase().includes(busca.toLowerCase())
      const matchEstado = estadoFilter === '' || c.estado === estadoFilter
      return matchBusca && matchEstado
    })
  }, [busca, estadoFilter, cidades])

  const maxFat = Math.max(...cidades.map((c) => c.faturamento_total), 1)

  const estados = useMemo(() => [...new Set(cidades.map((c) => c.estado))].sort(), [cidades])

  const faturamentoFiltrado = cidadesFiltradas.reduce((s, c) => s + c.faturamento_total, 0)
  const clientesFiltrados = cidadesFiltradas.reduce((s, c) => s + c.total_clientes, 0)
  const nfsFiltradas = cidadesFiltradas.reduce((s, c) => s + c.total_nfs, 0)

  const clientesListaFiltrada = useMemo(() => {
    const raw = buscaCliente.trim()
    const q = raw.replace(/\D/g, '')
    const nameQ = raw.toLowerCase()
    return clientes.filter((c) => {
      const matchUf = estadoCliente === '' || c.estado === estadoCliente

      const acao = acoesByCnpj.get(insightsCnpjKey(c.cnpj_cliente))
      const estadoAcao: InsightsAcaoEstado = acao?.estado ?? 'pendente'
      const matchAcao = acaoFilter === 'todos' || estadoAcao === acaoFilter
      if (!matchAcao) return false

      if (raw === '') return matchUf
      const cnpjDigits = insightsCnpjKey(c.cnpj_cliente)
      const matchCnpj = q.length >= 2 && cnpjDigits.includes(q)
      const matchNome = c.nome_cliente?.toLowerCase().includes(nameQ) ?? false
      const matchCidade = c.cidade?.toLowerCase().includes(nameQ) ?? false
      const matchUfText = c.estado?.toLowerCase() === nameQ
      return matchUf && (matchCnpj || matchNome || matchCidade || matchUfText)
    })
  }, [buscaCliente, estadoCliente, clientes, acoesByCnpj, acaoFilter])

  const acaoCounts = useMemo(() => {
    const c: Record<'todos' | InsightsAcaoEstado, number> = {
      todos: clientes.length,
      pendente: 0,
      em_acao: 0,
      resolvido: 0,
      snooze: 0,
      arquivado: 0,
    }
    for (const cli of clientes) {
      const a = acoesByCnpj.get(insightsCnpjKey(cli.cnpj_cliente))
      const estado: InsightsAcaoEstado = a?.estado ?? 'pendente'
      c[estado]++
    }
    return c
  }, [clientes, acoesByCnpj])

  // ─── Top acionáveis + paginação ───────────────────────────────────────────
  const cidadesTopAcionaveis = useMemo(
    () => topCidadesPrioritarias(cidadesFiltradas, 10),
    [cidadesFiltradas]
  )
  const cidadesPag = usePagination({
    items: cidadesFiltradas,
    initialPageSize: 25,
    resetKey: `${busca}|${estadoFilter}`,
  })

  const clientesTopAcionaveis = useMemo(
    () => topClientesPrioritarios(clientesListaFiltrada, periodo.fim, 10),
    [clientesListaFiltrada, periodo.fim]
  )
  const clientesPag = usePagination({
    items: clientesListaFiltrada,
    initialPageSize: 25,
    resetKey: `${buscaCliente}|${estadoCliente}|${acaoFilter}`,
  })

  // ─── Detalhe de cliente ───────────────────────────────────────────────────
  if (clienteDetalhe) {
    return (
      <div className="animate-fade-in">
        <PageHeader
          title="Insights"
          description={`Base histórica ${formatPeriodoLabel(periodo.inicio)} – ${formatPeriodoLabel(periodo.fim)}`}
        />
        <ClienteDetalheDrawer
          cliente={clienteDetalhe}
          periodo={periodo}
          acao={acoesByCnpj.get(insightsCnpjKey(clienteDetalhe.cnpj_cliente))}
          onClose={() => {
            setClienteDetalhe(null)
            setInsightsTab(tabBeforeDetail)
          }}
        />
      </div>
    )
  }

  // ─── Visão principal (abas) ───────────────────────────────────────────────
  if (boot.isPending) {
    return (
      <div className="animate-fade-in flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-sm">Carregando dados de Insights…</p>
      </div>
    )
  }

  if (boot.isError) {
    const msg = boot.error instanceof Error ? boot.error.message : String(boot.error)
    return (
      <div className="animate-fade-in p-6 rounded-lg border border-destructive/30 bg-destructive/5 text-sm text-destructive">
        {msg}
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Insights"
        description={`Base histórica ${formatPeriodoLabel(periodo.inicio)} – ${formatPeriodoLabel(periodo.fim)} · ${kpi.total_cidades} cidades`}
      />

      <Tabs value={insightsTab} onValueChange={(v) => setInsightsTab(v as 'territorio' | 'clientes' | 'produtos')}>
        <TabsList
          variant="line"
          className="mb-5 w-fit max-w-full h-auto gap-8 border-0 border-b border-border/40 bg-transparent p-0"
        >
          <TabsTrigger
            value="territorio"
            className="px-0 py-2 text-sm font-medium text-muted-foreground data-active:text-foreground data-active:font-semibold"
          >
            Território
          </TabsTrigger>
          <TabsTrigger
            value="clientes"
            className="px-0 py-2 text-sm font-medium text-muted-foreground data-active:text-foreground data-active:font-semibold"
          >
            Clientes
          </TabsTrigger>
          <TabsTrigger
            value="produtos"
            className="px-0 py-2 text-sm font-medium text-muted-foreground data-active:text-foreground data-active:font-semibold"
          >
            Produtos
          </TabsTrigger>
        </TabsList>

        <KPIGrid columns={5} className="mb-6">
          <KPICard
            label="Faturamento Total"
            value={formatCurrency(kpi.faturamento_total)}
            icon={DollarSign}
            variant="primary"
          />
          <KPICard label="Cidades" value={kpi.total_cidades} icon={MapPin} />
          <KPICard label="Clientes Únicos" value={kpi.total_clientes} icon={Users} />
          <KPICard label="NFs Emitidas" value={kpi.total_nfs.toLocaleString('pt-BR')} icon={Receipt} />
          <KPICard label="SKUs Ativos" value={kpi.total_skus} icon={Package} />
        </KPIGrid>

        <TabsContent value="territorio" className="mt-0">
          <FilterBar columns={2}>
            <FilterField label="Buscar cidade / estado">
              <Input
                placeholder="João Pessoa, PB…"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="h-8 text-sm"
              />
            </FilterField>
            <FilterField label="Estado">
              <div className="flex gap-1.5 flex-wrap">
                <Button
                  size="sm"
                  variant={estadoFilter === '' ? 'default' : 'outline'}
                  className="h-8 text-xs"
                  onClick={() => setEstadoFilter('')}
                >
                  Todos
                </Button>
                {estados.map((uf) => (
                  <Button
                    key={uf}
                    size="sm"
                    variant={estadoFilter === uf ? 'default' : 'outline'}
                    className="h-8 text-xs"
                    onClick={() => setEstadoFilter(uf)}
                  >
                    {uf}
                  </Button>
                ))}
              </div>
            </FilterField>
          </FilterBar>

          {(busca !== '' || estadoFilter !== '') && (
            <KPIGrid columns={3} className="mb-6">
              <KPICard label="Faturamento (filtro)" value={formatCurrency(faturamentoFiltrado)} icon={DollarSign} />
              <KPICard label="Clientes (filtro)" value={clientesFiltrados} icon={Users} />
              <KPICard label="NFs (filtro)" value={nfsFiltradas} icon={Receipt} />
            </KPIGrid>
          )}

          <InsightsTerritoryCharts
            cidades={cidadesFiltradas}
            faturamentoFiltrado={faturamentoFiltrado}
            mesGlobal={mesGlobalQ.data ?? []}
          />

          {cidadesFiltradas.length > cidadesPag.pageSize && (
            <TopAcionaveis
              eyebrow="Prioridade · Mercados foco"
              description="Top 10 por faturamento × penetração de clientes — onde o sell-out histórico foi mais relevante."
              items={cidadesTopAcionaveis}
              getKey={(row) => cidadeTerritorioKey(row.cidade, row.estado)}
              onItemClick={(row) => setBusca(row.cidade)}
              renderItem={(row) => (
                <div>
                  <p className="flex items-baseline gap-2 flex-wrap">
                    <span className="font-medium text-foreground truncate">{row.cidade}</span>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {row.estado}
                    </span>
                  </p>
                  <p className="mt-0.5 flex items-baseline gap-2 text-xs tabular-nums">
                    <span className="font-semibold text-foreground">
                      {formatCurrency(row.faturamento_total)}
                    </span>
                    <span className="text-muted-foreground">
                      {row.total_clientes} clientes · {row.total_nfs} NFs
                    </span>
                  </p>
                </div>
              )}
            />
          )}

          <SectionTitle title="Cidades" icon={MapPin} />
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cidade</TableHead>
                    <TableHead className="text-right">Faturamento</TableHead>
                    <TableHead className="hidden sm:table-cell text-right">NFs</TableHead>
                    <TableHead className="hidden md:table-cell text-right">Clientes</TableHead>
                    <TableHead className="hidden lg:table-cell text-right">SKUs</TableHead>
                    <TableHead className="hidden lg:table-cell">Participação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cidadesFiltradas.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                        Nenhuma cidade encontrada para os filtros selecionados.
                      </TableCell>
                    </TableRow>
                  )}
                  {cidadesPag.paginated.map((row) => {
                    const k = cidadeTerritorioKey(row.cidade, row.estado)
                    const topClientes = topPorCidade.get(k) ?? []
                    return (
                      <CidadeRow
                        key={k}
                        row={row}
                        maxFat={maxFat}
                        topClientes={topClientes}
                        onSelectCliente={openClienteDetalhe}
                      />
                    )
                  })}
                </TableBody>
              </Table>
              <PaginationBar
                page={cidadesPag.page}
                pageSize={cidadesPag.pageSize}
                total={cidadesPag.total}
                onPageChange={cidadesPag.setPage}
                onPageSizeChange={cidadesPag.setPageSize}
              />
            </CardContent>
          </Card>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(
              cidadesFiltradas.reduce<Record<string, number>>((acc, c) => {
                acc[c.estado] = (acc[c.estado] ?? 0) + c.faturamento_total
                return acc
              }, {})
            )
              .sort(([, a], [, b]) => b - a)
              .map(([uf, fat]) => {
                const denom = faturamentoFiltrado > 0 ? faturamentoFiltrado : 1
                const pct = (fat / denom) * 100
                return (
                  <Card key={uf} className={cn(estadoFilter === uf && 'border-primary/30 bg-primary/5')}>
                    <CardContent>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{uf}</span>
                        <Badge variant="secondary" className="text-[10px]">{pct.toFixed(1)}%</Badge>
                      </div>
                      <p className="text-base font-bold tabular-nums">{formatCurrency(fat)}</p>
                      <div className="mt-2 h-1.5 bg-muted/50 rounded overflow-hidden">
                        <div className="h-full bg-primary/70 rounded" style={{ width: `${pct}%` }} />
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
          </div>
        </TabsContent>

        <TabsContent value="clientes" className="mt-0">
          <p className="text-sm text-muted-foreground mb-4">
            Consulta por CNPJ, razão social ou cidade. Clique em uma linha para ver histórico e mix.
          </p>
          <FilterBar columns={2}>
            <FilterField label="Buscar CNPJ, nome ou cidade">
              <Input
                placeholder="07891234…, Supermercado, Recife…"
                value={buscaCliente}
                onChange={(e) => setBuscaCliente(e.target.value)}
                className="h-8 text-sm"
              />
            </FilterField>
            <FilterField label="Estado">
              <div className="flex gap-1.5 flex-wrap">
                <Button
                  size="sm"
                  variant={estadoCliente === '' ? 'default' : 'outline'}
                  className="h-8 text-xs"
                  onClick={() => setEstadoCliente('')}
                >
                  Todos
                </Button>
                {estados.map((uf) => (
                  <Button
                    key={uf}
                    size="sm"
                    variant={estadoCliente === uf ? 'default' : 'outline'}
                    className="h-8 text-xs"
                    onClick={() => setEstadoCliente(uf)}
                  >
                    {uf}
                  </Button>
                ))}
              </div>
            </FilterField>
          </FilterBar>

          <div className="mb-5 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mr-1">
              Status da ação
            </span>
            {(['todos', 'pendente', 'em_acao', 'resolvido', 'snooze', 'arquivado'] as const).map(
              (estado) => {
                const label = estado === 'todos' ? 'Todos' : INSIGHTS_ACAO_LABEL[estado]
                const count = acaoCounts[estado]
                return (
                  <Button
                    key={estado}
                    size="sm"
                    variant={acaoFilter === estado ? 'default' : 'outline'}
                    className="h-7 text-xs gap-1.5"
                    onClick={() => setAcaoFilter(estado)}
                  >
                    {label}
                    <span className="opacity-60 tabular-nums">{count}</span>
                  </Button>
                )
              }
            )}
          </div>

          <InsightsClientesCharts clientes={clientesListaFiltrada} />

          {clientesListaFiltrada.length > clientesPag.pageSize && (
            <TopAcionaveis
              eyebrow="Prioridade · Clientes a recuperar"
              description={`Top 10 por faturamento histórico × gap até o fim do período (${formatPeriodoLabel(periodo.fim)}). Clientes que pararam mais cedo dentro do histórico Arruda — candidatos para reativação via distribuidor.`}
              items={clientesTopAcionaveis}
              getKey={(c) => c.cnpj_cliente}
              onItemClick={(c) => openClienteDetalhe(c)}
              renderItem={(c) => {
                const ultimaCompra = c.ultima_compra
                  ? new Date(`${c.ultima_compra}T12:00:00`).toLocaleDateString('pt-BR', {
                      month: 'short',
                      year: '2-digit',
                    })
                  : '—'
                return (
                  <div>
                    <p className="flex items-baseline gap-2 flex-wrap">
                      <span className="font-medium text-foreground truncate">
                        {c.nome_cliente}
                      </span>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {c.cidade}/{c.estado}
                      </span>
                    </p>
                    <p className="mt-0.5 flex items-baseline gap-2 text-xs tabular-nums">
                      <span className="font-semibold text-foreground">
                        {formatCurrency(c.faturamento_total)}
                      </span>
                      <span className="text-muted-foreground">
                        última {ultimaCompra}
                        {c.__gapMeses > 0 && (
                          <span className="ml-1 text-amber-700 dark:text-amber-500">
                            · {c.__gapMeses}m antes do fim
                          </span>
                        )}
                      </span>
                    </p>
                  </div>
                )
              }}
            />
          )}

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="hidden sm:table-cell">Cidade / UF</TableHead>
                    <TableHead className="hidden md:table-cell font-mono text-xs">CNPJ</TableHead>
                    <TableHead className="text-right">Faturamento</TableHead>
                    <TableHead className="hidden lg:table-cell text-right">NFs</TableHead>
                    <TableHead className="hidden lg:table-cell text-right">SKUs</TableHead>
                    <TableHead className="w-36 text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientesListaFiltrada.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-10">
                        Nenhum cliente encontrado.
                      </TableCell>
                    </TableRow>
                  )}
                  {clientesPag.paginated.map((c) => (
                    <TableRow
                      key={c.cnpj_cliente}
                      className="cursor-pointer"
                      onClick={() => openClienteDetalhe(c)}
                    >
                      <TableCell className="font-medium max-w-[220px]">
                        <span className="flex items-center gap-2">
                          <span className="truncate">{c.nome_cliente}</span>
                          <InsightsClienteBrasilBadge status={c.brasil_enriquecimento_status} />
                        </span>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                        {c.cidade} / {c.estado}
                      </TableCell>
                      <TableCell className="hidden md:table-cell font-mono text-xs text-muted-foreground">
                        {c.cnpj_cliente}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatCurrency(c.faturamento_total)}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-right tabular-nums">{c.total_nfs}</TableCell>
                      <TableCell className="hidden lg:table-cell text-right tabular-nums">{c.total_skus}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1.5">
                          <InsightsAcaoMenu
                            cnpj={c.cnpj_cliente}
                            acao={acoesByCnpj.get(insightsCnpjKey(c.cnpj_cliente))}
                          />
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <PaginationBar
                page={clientesPag.page}
                pageSize={clientesPag.pageSize}
                total={clientesPag.total}
                onPageChange={clientesPag.setPage}
                onPageSizeChange={clientesPag.setPageSize}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="produtos" className="mt-0">
          <InsightsAbaProdutos />
        </TabsContent>
      </Tabs>
    </div>
  )
}
