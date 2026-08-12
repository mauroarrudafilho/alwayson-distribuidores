import { useMemo } from 'react'
import { DollarSign, Users, ShoppingCart } from 'lucide-react'
import { KPICard } from '@/components/distribuidor/KPICard'
import { KPIGrid } from '@/components/distribuidor/KPIGrid'
import { useVendedorHierarchy } from '@/hooks/usePerformanceHierarchy'
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
import { ColunaEvolucao, calcularVariacaoLinha } from './ColunaEvolucao'
import { useSerieHierarquia } from '@/hooks/useSerieEntidade'
import { calcularJanela, calcularComparacao } from '@/lib/janela-periodo'
import { EvolucaoGraficoNivel } from './EvolucaoGraficoNivel'

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

  const isLoading = loadingHierarchy || loadingPerf

  const janela = calcularJanela(filters.janela)
  const comparacao = calcularComparacao(janela, filters.comparar)
  const { data: series } = useSerieHierarquia(filters.distribuidorId, 'gerente', janela)
  const { data: seriesAnterior } = useSerieHierarquia(
    filters.distribuidorId,
    'gerente',
    comparacao ?? janela
  )

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
        variacao: calcularVariacaoLinha(
          series?.get(gerente.id),
          comparacao ? seriesAnterior?.get(gerente.id) : undefined
        ),
      }
    })
  }, [hierarchy, sales, series, seriesAnterior, comparacao])

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
      <KPIGrid columns={3}>
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
      </KPIGrid>

      <EvolucaoGraficoNivel
        janela={janela}
        comparacao={comparacao}
        entidades={hierarchy?.gerentes ?? []}
        series={series}
        seriesAnterior={seriesAnterior}
        onEntidadeClick={handleRowClick}
      />

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
              <SortableNumericHead
                label="Evolução"
                field="variacao"
                sortField={sortField}
                sortDir={sortDir}
                onSort={toggleSort}
                className="hidden lg:table-cell"
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
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
                  <ColunaEvolucao
                    serie={series?.get(row.id)}
                    variacao={row.variacao}
                    className="hidden lg:table-cell"
                  />
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
