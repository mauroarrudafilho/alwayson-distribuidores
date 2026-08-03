import { useMemo } from 'react'
import { DollarSign, Users, ShoppingCart, Target } from 'lucide-react'
import { KPICard } from '@/components/distribuidor/KPICard'
import { KPIGrid } from '@/components/distribuidor/KPIGrid'
import { MetaProgressBar } from '@/components/distribuidor/MetaProgressBar'
import {
  useVendedorHierarchy,
  useMetasByLevel,
} from '@/hooks/usePerformanceHierarchy'
import { useFaturamentoSales, aggregateSales } from '@/hooks/useFaturamentoPerformance'
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
import { nextTabInOrder } from './usePerfFilters'
import { SortableNumericHead, useSortedMetricRows } from './sortableNumeric'

export function GerenciaTab() {
  const { filters, drillDown, availableTabs } = usePerformanceContext()
  const { distribuidorId, periodoInicio, periodoFim } = filters

  const { data: hierarchy, isLoading: loadingHierarchy } =
    useVendedorHierarchy(distribuidorId)
  const { data: sales = [], isLoading: loadingPerf } = useFaturamentoSales(
    distribuidorId,
    periodoInicio,
    periodoFim
  )
  const { data: metas } = useMetasByLevel(distribuidorId, 'distribuidor', undefined, periodoInicio)

  const isLoading = loadingHierarchy || loadingPerf

  const rows = useMemo(() => {
    if (!hierarchy) return []
    return hierarchy.gerentes.map((gerente) => {
      const subordinateIds = hierarchy.getSubordinateIds(gerente.id)
      const allIds = new Set([gerente.id, ...subordinateIds])
      const scoped = sales.filter((s) => allIds.has(s.vendedor_id))
      const agg = aggregateSales(scoped)
      return {
        ...gerente,
        faturamento: agg.faturamento,
        positivados: agg.clientes_positivados,
        itens: agg.itens_vendidos,
        pedidos: agg.pedidos_realizados,
      }
    })
  }, [hierarchy, sales])

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
    const m = (metas ?? []).find((meta) => meta.tipo === 'faturamento')
    if (!m) return null
    return {
      meta: Number(m.valor_meta),
      realizado: Number(m.valor_realizado),
      percentual: Number(m.percentual_atingimento),
    }
  }, [metas])

  const handleRowClick = (gerenteId: string) => {
    drillDown(nextTabInOrder('gerencia', availableTabs), { distribuidorId, gerenteId })
  }

  if (!distribuidorId) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-muted-foreground">
          Selecione um distribuidor para visualizar a gerência
        </p>
      </div>
    )
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
              <TableHead>Gerente</TableHead>
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
              />
              <SortableNumericHead
                label="Itens"
                field="itens"
                sortField={sortField}
                sortDir={sortDir}
                onSort={toggleSort}
              />
              <SortableNumericHead
                label="Pedidos"
                field="pedidos"
                sortField={sortField}
                sortDir={sortDir}
                onSort={toggleSort}
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 5 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center">
                  <p className="text-xs text-muted-foreground">
                    Nenhum gerente encontrado
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
                  <TableCell className="text-xs font-medium">
                    {row.nome}
                  </TableCell>
                  <TableCell className="text-xs tabular-nums text-right">
                    {formatCurrency(row.faturamento)}
                  </TableCell>
                  <TableCell className="text-xs tabular-nums text-right">
                    {row.positivados.toLocaleString('pt-BR')}
                  </TableCell>
                  <TableCell className="text-xs tabular-nums text-right">
                    {row.itens.toLocaleString('pt-BR')}
                  </TableCell>
                  <TableCell className="text-xs tabular-nums text-right">
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
