import { useMemo } from 'react'
import { DollarSign, Users, ShoppingCart, Target } from 'lucide-react'
import { KPICard } from '@/components/distribuidor/KPICard'
import { KPIGrid } from '@/components/distribuidor/KPIGrid'
import { MetaProgressBar } from '@/components/distribuidor/MetaProgressBar'
import { useDistribuidores } from '@/hooks/useDistribuidores'
import { useMetas } from '@/hooks/useMetas'
import {
  useAllFaturamentoSales,
  aggregateSales,
  aggregateSalesBy,
} from '@/hooks/useFaturamentoPerformance'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/format'
import { usePerformanceContext } from './PerformanceContext'
import { SortableNumericHead, useSortedMetricRows } from './sortableNumeric'
import type { PerfTab } from './usePerfFilters'

export function DistribuidorTab() {
  const { drillDown, availableTabs, filters } = usePerformanceContext()
  const { periodoInicio, periodoFim } = filters
  const { data: distribuidores, isLoading: loadingDist } = useDistribuidores()
  const { data: sales = [], isLoading: loadingPerf } = useAllFaturamentoSales(
    periodoInicio,
    periodoFim
  )
  const { data: metas } = useMetas()

  const isLoading = loadingDist || loadingPerf

  const rows = useMemo(() => {
    if (!distribuidores) return []
    const byDist = aggregateSalesBy(sales, (r) => r.distribuidor_id)
    return distribuidores.map((dist) => {
      const agg = byDist.get(dist.id) ?? {
        faturamento: 0,
        clientes_positivados: 0,
        itens_vendidos: 0,
        pedidos_realizados: 0,
      }
      return {
        ...dist,
        faturamento: agg.faturamento,
        positivados: agg.clientes_positivados,
        itens: agg.itens_vendidos,
        pedidos: agg.pedidos_realizados,
      }
    })
  }, [distribuidores, sales])

  const { sortedRows, sortField, sortDir, toggleSort } = useSortedMetricRows(rows)

  const totals = useMemo(() => {
    const agg = aggregateSales(sales)
    return {
      faturamento: agg.faturamento,
      positivados: agg.clientes_positivados,
      itens: agg.itens_vendidos,
      pedidos: agg.pedidos_realizados,
    }
  }, [sales])

  const metaFaturamento = useMemo(() => {
    // Sem mês definido não dá para escolher a meta certa — melhor não exibir
    // nenhuma do que exibir a de outro período.
    if (!periodoInicio) return null
    const m = (metas ?? []).find(
      (meta) =>
        meta.hierarquia === 'distribuidor' &&
        meta.tipo === 'faturamento' &&
        // Sem este filtro, pega a meta do mês mais recente (a lista vem
        // ordenada por período desc) e a compara com o realizado do mês escolhido.
        meta.periodo_inicio.startsWith(periodoInicio)
    )
    if (!m) return null
    return {
      meta: Number(m.valor_meta),
      realizado: Number(m.valor_realizado ?? 0),
      percentual: Number(m.percentual_atingimento ?? 0),
    }
  }, [metas, periodoInicio])

  const nextTab = useMemo<PerfTab>(() => {
    const afterDist = availableTabs.find(
      (t) => t !== 'distribuidor' && t !== 'cliente'
    )
    return afterDist ?? 'vendas'
  }, [availableTabs])

  const handleRowClick = (distribuidorId: string) => {
    drillDown(nextTab, { distribuidorId })
  }

  return (
    <div className="space-y-6 mt-4">
      <KPIGrid columns={4}>
        <KPICard
          label="Faturamento Total"
          value={formatCurrency(totals.faturamento)}
          icon={DollarSign}
          variant="primary"
        />
        <KPICard
          label="Clientes Positivados"
          value={totals.positivados.toLocaleString('pt-BR')}
          icon={Users}
        />
        <KPICard
          label="Itens Vendidos"
          value={totals.itens.toLocaleString('pt-BR')}
          icon={ShoppingCart}
        />
        <KPICard
          label="Meta vs Realizado"
          value={
            metaFaturamento
              ? `${metaFaturamento.percentual.toFixed(1)}%`
              : '—'
          }
          icon={Target}
        />
      </KPIGrid>

      {metaFaturamento && (
        <MetaProgressBar
          label="Faturamento"
          percentual={metaFaturamento.percentual}
          meta={formatCurrency(metaFaturamento.meta)}
          realizado={formatCurrency(metaFaturamento.realizado)}
        />
      )}

      <Card>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Distribuidor</TableHead>
              <TableHead>Estado</TableHead>
              <SortableNumericHead
                label="Faturamento"
                field="faturamento"
                sortField={sortField}
                sortDir={sortDir}
                onSort={toggleSort}
              />
              <SortableNumericHead
                label="Positivados"
                field="positivados"
                sortField={sortField}
                sortDir={sortDir}
                onSort={toggleSort}
                className="hidden sm:table-cell"
              />
              <SortableNumericHead
                label="Itens"
                field="itens"
                sortField={sortField}
                sortDir={sortDir}
                onSort={toggleSort}
                className="hidden md:table-cell"
              />
              <SortableNumericHead
                label="Pedidos"
                field="pedidos"
                sortField={sortField}
                sortDir={sortDir}
                onSort={toggleSort}
                className="hidden md:table-cell"
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 3 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center">
                  <p className="text-xs text-muted-foreground">
                    Nenhum distribuidor encontrado
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              sortedRows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => handleRowClick(row.id)}
                >
                  <TableCell className="text-xs font-medium max-w-[150px] sm:max-w-none truncate">
                    {row.nome}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {row.estado}
                  </TableCell>
                  <TableCell className="text-xs tabular-nums text-right">
                    {formatCurrency(row.faturamento)}
                  </TableCell>
                  <TableCell className="text-xs tabular-nums text-right hidden sm:table-cell">
                    {row.positivados.toLocaleString('pt-BR')}
                  </TableCell>
                  <TableCell className="text-xs tabular-nums text-right hidden md:table-cell">
                    {row.itens.toLocaleString('pt-BR')}
                  </TableCell>
                  <TableCell className="text-xs tabular-nums text-right hidden md:table-cell">
                    {row.pedidos.toLocaleString('pt-BR')}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
