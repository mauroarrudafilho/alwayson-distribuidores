import { useMemo, useState } from 'react'
import {
  Package,
  ChevronRight,
  Users,
  MapPin,
  Loader2,
  BarChart3,
  Layers,
  Target,
  ArrowLeft,
  Percent,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { InsightsSortableTh } from '@/components/insights/InsightsSortableTh'
import { useInsightsTableSort } from '@/hooks/useInsightsTableSort'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FilterBar, FilterField } from '@/components/distribuidor/FilterBar'
import { formatCurrency } from '@/lib/format'
import type { InsightsProdutoDetalhe, InsightsProdutoRow } from '@/types/insights'
import {
  queryErrorMessage,
  useInsightsProdutoExpandido,
  useInsightsProdutos,
} from '@/hooks/useInsightsQueries'
import { usePagination } from '@/hooks/usePagination'
import { PaginationBar } from '@/components/ui/pagination-bar'
import {
  TopAcionaveis,
  insightsListMetaClass,
  insightsListTitleClass,
} from '@/components/insights/TopAcionaveis'
import { topProdutosPrioritarios } from '@/lib/insights-priority'
import { InsightsOticaIntro } from '@/components/insights/InsightsOticaIntro'
import { InsightsContextKpis } from '@/components/insights/InsightsContextKpis'
import { buildProdutosKpis, type ContextualKpi } from '@/lib/insights-contextual-kpis'
import { InsightsExplorarCard } from '@/components/insights/InsightsExplorarCard'
import { InsightsProdutoDetalheCharts } from '@/components/insights/InsightsProdutoDetalheCharts'
import {
  INSIGHTS_FILTRO_TODOS,
  insightsSelectOnChange,
  insightsSelectValue,
} from '@/lib/insights-filters'

function formatPct(pct: number): string {
  if (!Number.isFinite(pct) || pct <= 0) return '—'
  if (pct < 0.1) return '<0,1%'
  return `${pct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
}

function shareOf(part: number, total: number): number {
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) return 0
  return (part / total) * 100
}

function buildSkuDetalheKpis(
  row: InsightsProdutoRow,
  detalhe: InsightsProdutoDetalhe
): ContextualKpi[] {
  const fatSku = row.faturamento_total
  const top3Cli = detalhe.topClientes.slice(0, 3).reduce((s, c) => s + c.faturamento_total, 0)
  const top3Cid = detalhe.topCidades.slice(0, 3).reduce((s, c) => s + c.faturamento_total, 0)
  const top1 = detalhe.topClientes[0]

  return [
    {
      id: 'clientes',
      label: 'Clientes no SKU',
      value: row.total_clientes.toLocaleString('pt-BR'),
      subtitle: `${row.total_cidades.toLocaleString('pt-BR')} cidades`,
    },
    {
      id: 'top3cli',
      label: 'Top 3 clientes',
      value: formatPct(shareOf(top3Cli, fatSku)),
      subtitle: 'Concentração de receita no SKU',
      variant: shareOf(top3Cli, fatSku) >= 40 ? 'primary' : 'default',
    },
    {
      id: 'top3cid',
      label: 'Top 3 cidades',
      value: formatPct(shareOf(top3Cid, fatSku)),
      subtitle: 'Peso geográfico no histórico',
    },
    {
      id: 'lider',
      label: 'Cliente líder',
      value: top1 ? formatPct(shareOf(top1.faturamento_total, fatSku)) : '—',
      subtitle: top1
        ? top1.nome_cliente.length > 36
          ? `${top1.nome_cliente.slice(0, 35)}…`
          : top1.nome_cliente
        : 'Sem dados',
    },
  ]
}

function ProdutoDetalhePanel({
  row,
  fatTotal,
  detalhe,
  pending,
  error,
  onBack,
}: {
  row: InsightsProdutoRow
  fatTotal: number
  detalhe: InsightsProdutoDetalhe | null | undefined
  pending: boolean
  error: Error | null
  onBack: () => void
}) {
  const pct = fatTotal > 0 ? (row.faturamento_total / fatTotal) * 100 : 0
  const fatSku = row.faturamento_total

  const detalheKpis = useMemo(
    () => (detalhe ? buildSkuDetalheKpis(row, detalhe) : []),
    [detalhe, row]
  )

  const DETALHE_KPI_ICONS = {
    clientes: Users,
    top3cli: Percent,
    top3cid: MapPin,
    lider: Target,
    default: Package,
  }

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" className="h-8 gap-1.5 -ml-2" onClick={onBack}>
        <ArrowLeft className="w-3.5 h-3.5" />
        Voltar ao mix
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs text-muted-foreground">{row.sku}</p>
          <h2 className="font-display text-lg font-normal text-foreground mt-0.5">{row.descricao}</h2>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge variant="outline" className="text-[10px]">
              {row.categoria}
            </Badge>
            {row.marca !== '—' && (
              <Badge variant="secondary" className="text-[10px]">
                {row.marca}
              </Badge>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-semibold tabular-nums">{formatCurrency(row.faturamento_total)}</p>
          <p className="text-xs text-muted-foreground tabular-nums">
            {formatPct(pct)} do mix filtrado · {row.total_clientes} clientes · {row.total_cidades}{' '}
            cidades
          </p>
        </div>
      </div>

      {pending && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-10">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando detalhes do SKU…
        </div>
      )}
      {!pending && error && <p className="text-sm text-destructive">{error.message}</p>}
      {!pending && !error && detalhe && (
        <div className="space-y-5">
          <InsightsContextKpis kpis={detalheKpis} icons={DETALHE_KPI_ICONS} />
          <p className="text-xs text-muted-foreground -mt-1">
            Leitura de comportamento e oportunidade do item — quem puxa volume, onde concentra e
            onde há espaço para crescer.
          </p>
          <InsightsProdutoDetalheCharts
            sku={row.sku}
            skuDescricao={row.descricao}
            detalhe={detalhe}
            fatSku={fatSku}
          />
        </div>
      )}
    </div>
  )
}

export function InsightsAbaProdutos({
  periodoLabel = 'Histórico Arruda',
  active = true,
  estadoFilter = '',
  onEstadoChange,
  estados = [],
}: {
  periodoLabel?: string
  active?: boolean
  /** UF compartilhada com as outras óticas. */
  estadoFilter?: string
  onEstadoChange?: (uf: string) => void
  estados?: string[]
}) {
  const [busca, setBusca] = useState('')
  const [categoria, setCategoria] = useState('')
  const [selectedSku, setSelectedSku] = useState<string | null>(null)

  const { data: produtos = [], isPending, isError, error } = useInsightsProdutos({ enabled: active })
  const drill = useInsightsProdutoExpandido(selectedSku)

  const categorias = useMemo(
    () => [...new Set(produtos.map((p) => p.categoria))].sort(),
    [produtos]
  )

  /** Escopo de foco/gráficos — só categoria (busca fica na base explorar). */
  const produtosEscopo = useMemo(() => {
    return produtos.filter((p) => categoria === '' || p.categoria === categoria)
  }, [categoria, produtos])

  const fatTotal = useMemo(
    () => produtosEscopo.reduce((s, p) => s + p.faturamento_total, 0),
    [produtosEscopo]
  )

  const produtosLista = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return produtosEscopo
    return produtosEscopo.filter(
      (p) => p.sku.toLowerCase().includes(q) || p.descricao.toLowerCase().includes(q)
    )
  }, [busca, produtosEscopo])

  type ProdutoComPct = InsightsProdutoRow & { pct: number; cumPct: number }

  const produtosComPct = useMemo((): ProdutoComPct[] => {
    let cum = 0
    return [...produtosLista]
      .sort((a, b) => b.faturamento_total - a.faturamento_total)
      .map((p) => {
        const pct = fatTotal > 0 ? (p.faturamento_total / fatTotal) * 100 : 0
        cum += pct
        return { ...p, pct, cumPct: cum }
      })
  }, [produtosLista, fatTotal])

  const produtosAccessors = useMemo(
    () => ({
      sku: (p: ProdutoComPct) => p.sku,
      descricao: (p: ProdutoComPct) => p.descricao,
      categoria: (p: ProdutoComPct) => p.categoria,
      faturamento: (p: ProdutoComPct) => p.faturamento_total,
      pct: (p: ProdutoComPct) => p.pct,
      cum: (p: ProdutoComPct) => p.cumPct,
      clientes: (p: ProdutoComPct) => p.total_clientes,
    }),
    []
  )
  const produtosSort = useInsightsTableSort(produtosComPct, produtosAccessors, {
    key: 'faturamento',
    dir: 'desc',
  })

  const produtosTopAcionaveis = useMemo(
    () => topProdutosPrioritarios(produtosEscopo, 10),
    [produtosEscopo]
  )

  const produtosKpis = useMemo(
    () => buildProdutosKpis(produtosEscopo, fatTotal),
    [produtosEscopo, fatTotal]
  )

  const PRODUTOS_KPI_ICONS = {
    skus: Package,
    pareto: BarChart3,
    estrategicos: Target,
    alcance: Layers,
    default: Package,
  }

  const produtosPag = usePagination({
    items: produtosSort.sorted,
    initialPageSize: 25,
    resetKey: `${busca}|${categoria}|${estadoFilter}|${produtosSort.sort.key}|${produtosSort.sort.dir}`,
  })

  const selectedRow = selectedSku
    ? produtosComPct.find((p) => p.sku === selectedSku) ??
      produtos.find((p) => p.sku === selectedSku)
    : null

  if (isPending && produtos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm">Carregando produtos…</p>
      </div>
    )
  }

  if (isError) {
    return (
      <p className="text-sm text-destructive py-4">
        {queryErrorMessage(error)}
      </p>
    )
  }

  if (selectedSku && selectedRow) {
    return (
      <ProdutoDetalhePanel
        row={selectedRow}
        fatTotal={fatTotal}
        detalhe={drill.data}
        pending={drill.isPending}
        error={drill.isError ? (drill.error as Error) : null}
        onBack={() => setSelectedSku(null)}
      />
    )
  }

  return (
    <div className="mt-0">
      <InsightsOticaIntro otica="produtos" periodoLabel={periodoLabel} compact />
      <FilterBar columns={2}>
        <FilterField label="Categoria">
          <Select
            value={insightsSelectValue(categoria)}
            onValueChange={(v) => insightsSelectOnChange(v, setCategoria)}
          >
            <SelectTrigger className="h-9 w-full text-sm min-w-0">
              <SelectValue placeholder="Todas">{categoria || 'Todas'}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={INSIGHTS_FILTRO_TODOS}>Todas</SelectItem>
              {categorias.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label="Estado">
          <Select
            value={insightsSelectValue(estadoFilter)}
            onValueChange={(v) => {
              if (onEstadoChange) insightsSelectOnChange(v, onEstadoChange)
            }}
          >
            <SelectTrigger className="h-9 w-full text-sm min-w-0">
              <SelectValue placeholder="Todos">{estadoFilter || 'Todos'}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={INSIGHTS_FILTRO_TODOS}>Todos</SelectItem>
              {estados.map((uf) => (
                <SelectItem key={uf} value={uf}>
                  {uf}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
      </FilterBar>
      <p className="mb-4 -mt-2 text-xs text-muted-foreground tabular-nums">
        {formatCurrency(fatTotal)} no mix · {produtosEscopo.length.toLocaleString('pt-BR')} SKUs
        {estadoFilter ? ` · UF ${estadoFilter} sincronizada com Clientes/Território` : ''}
      </p>

      <InsightsContextKpis kpis={produtosKpis} icons={PRODUTOS_KPI_ICONS} className="mb-5" />

      {produtosTopAcionaveis.length > 0 && (
        <TopAcionaveis
          eyebrow="Foco no mix"
          description="SKUs com maior peso e adoção — prioridade de argumento de venda."
          items={produtosTopAcionaveis}
          getKey={(p) => p.sku}
          onItemClick={(p) => setSelectedSku(p.sku)}
          renderItem={(p) => {
            const pct = fatTotal > 0 ? (p.faturamento_total / fatTotal) * 100 : 0
            return (
              <div>
                <p className={insightsListTitleClass}>
                  <span className="mr-2 font-mono text-xs font-normal text-muted-foreground">
                    {p.sku}
                  </span>
                  {p.descricao}
                </p>
                <p className={insightsListMetaClass}>
                  <span className="font-medium text-foreground">
                    {formatCurrency(p.faturamento_total)}
                  </span>
                  <span className="mx-1 text-teal font-medium">{formatPct(pct)}</span>
                  <span>· {p.total_clientes} clientes</span>
                </p>
              </div>
            )
          }}
        />
      )}

      <InsightsExplorarCard
        title="Mix detalhado"
        countLabel={`${produtosComPct.length.toLocaleString('pt-BR')} SKUs`}
        search={busca}
        onSearchChange={setBusca}
        searchPlaceholder="Buscar SKU ou descrição…"
      >
          <Table>
            <TableHeader>
              <TableRow>
                <InsightsSortableTh
                  label="SKU"
                  active={produtosSort.sort.key === 'sku'}
                  dir={produtosSort.sort.dir}
                  onClick={() => produtosSort.toggle('sku')}
                />
                <InsightsSortableTh
                  label="Descrição"
                  active={produtosSort.sort.key === 'descricao'}
                  dir={produtosSort.sort.dir}
                  onClick={() => produtosSort.toggle('descricao')}
                />
                <InsightsSortableTh
                  label="Categoria"
                  className="hidden sm:table-cell"
                  active={produtosSort.sort.key === 'categoria'}
                  dir={produtosSort.sort.dir}
                  onClick={() => produtosSort.toggle('categoria')}
                />
                <InsightsSortableTh
                  label="Faturamento"
                  align="right"
                  active={produtosSort.sort.key === 'faturamento'}
                  dir={produtosSort.sort.dir}
                  onClick={() => produtosSort.toggle('faturamento')}
                />
                <InsightsSortableTh
                  label="% mix"
                  align="right"
                  className="w-20"
                  active={produtosSort.sort.key === 'pct'}
                  dir={produtosSort.sort.dir}
                  onClick={() => produtosSort.toggle('pct')}
                />
                <InsightsSortableTh
                  label="% acum."
                  align="right"
                  className="hidden md:table-cell"
                  active={produtosSort.sort.key === 'cum'}
                  dir={produtosSort.sort.dir}
                  onClick={() => produtosSort.toggle('cum')}
                />
                <InsightsSortableTh
                  label="Clientes"
                  align="right"
                  className="hidden lg:table-cell"
                  active={produtosSort.sort.key === 'clientes'}
                  dir={produtosSort.sort.dir}
                  onClick={() => produtosSort.toggle('clientes')}
                />
                <TableHead className="hidden xl:table-cell w-28">Concentração</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {produtosComPct.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-8">
                    Nenhum produto encontrado para os filtros selecionados.
                  </TableCell>
                </TableRow>
              )}
              {produtosPag.paginated.map((row) => (
                <TableRow
                  key={row.sku}
                  className="cursor-pointer"
                  onClick={() => setSelectedSku(row.sku)}
                >
                  <TableCell className="font-mono text-xs">{row.sku}</TableCell>
                  <TableCell className="font-medium max-w-[200px] truncate">{row.descricao}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {row.categoria}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {formatCurrency(row.faturamento_total)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm font-medium text-teal">
                    {formatPct(row.pct)}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-right tabular-nums text-xs text-muted-foreground">
                    {formatPct(row.cumPct)}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-right tabular-nums">
                    {row.total_clientes}
                  </TableCell>
                  <TableCell className="hidden xl:table-cell">
                    <div className="h-2.5 bg-muted/50 rounded overflow-hidden">
                      <div
                        className="h-full bg-primary/70 rounded"
                        style={{ width: `${Math.min(row.pct * 4, 100)}%` }}
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <PaginationBar
            page={produtosPag.page}
            pageSize={produtosPag.pageSize}
            total={produtosPag.total}
            onPageChange={produtosPag.setPage}
            onPageSizeChange={produtosPag.setPageSize}
          />
      </InsightsExplorarCard>
    </div>
  )
}
