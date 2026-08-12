import { useMemo } from 'react'
import { DollarSign, Users, ShoppingCart } from 'lucide-react'
import { KPICard } from '@/components/distribuidor/KPICard'
import { KPIGrid } from '@/components/distribuidor/KPIGrid'
import { FilterBar, FilterField } from '@/components/distribuidor/FilterBar'
import { useVendedorHierarchy } from '@/hooks/usePerformanceHierarchy'
import { useFaturamentoSales, aggregateSales } from '@/hooks/useFaturamentoPerformance'
import { Card } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { hierarchyPersonLabel } from './hierarchyLabels'
import { ColunaEvolucao, calcularVariacaoLinha } from './ColunaEvolucao'
import { useSerieHierarquia } from '@/hooks/useSerieEntidade'
import { calcularJanela, calcularComparacao } from '@/lib/janela-periodo'
import { EvolucaoGraficoNivel } from './EvolucaoGraficoNivel'

export function SupervisaoTab() {
  const { filters, setFilter, drillDown, availableTabs } = usePerformanceContext()
  const { distribuidorId, gerenteId, periodoInicio, periodoFim } = filters

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
  const { data: series } = useSerieHierarquia(filters.distribuidorId, 'supervisor', janela)
  const { data: seriesAnterior } = useSerieHierarquia(
    filters.distribuidorId,
    'supervisor',
    comparacao ?? janela
  )

  const filteredSupervisores = useMemo(() => {
    if (!hierarchy) return []
    if (gerenteId) {
      return hierarchy.supervisores.filter(
        (s) => s.supervisor_id === gerenteId
      )
    }
    return hierarchy.supervisores
  }, [hierarchy, gerenteId])

  const rows = useMemo(() => {
    if (!hierarchy) return []
    return filteredSupervisores.map((supervisor) => {
      const subordinateIds = hierarchy.getSubordinateIds(supervisor.id)
      const allIds = new Set([supervisor.id, ...subordinateIds])
      const scoped = sales.filter((s) => allIds.has(s.vendedor_id))
      const agg = aggregateSales(scoped)
      return {
        ...supervisor,
        faturamento: agg.faturamento,
        positivados: agg.clientes_positivados,
        itens: agg.itens_vendidos,
        pedidos: agg.pedidos_realizados,
        variacao: calcularVariacaoLinha(
          series?.get(supervisor.id),
          comparacao ? seriesAnterior?.get(supervisor.id) : undefined
        ),
      }
    })
  }, [hierarchy, sales, filteredSupervisores, series, seriesAnterior, comparacao])

  const { sortedRows, sortField, sortDir, toggleSort } = useSortedMetricRows(rows)

  const totals = useMemo(() => {
    if (!hierarchy) {
      const agg = aggregateSales(sales)
      return {
        faturamento: agg.faturamento,
        positivados: agg.clientes_positivados,
        itens: agg.itens_vendidos,
        pedidos: agg.pedidos_realizados,
      }
    }
    const scopedIds = new Set(
      filteredSupervisores.flatMap((s) => [s.id, ...hierarchy.getSubordinateIds(s.id)])
    )
    const scoped = sales.filter((s) => scopedIds.has(s.vendedor_id))
    const agg = aggregateSales(scoped)
    return {
      faturamento: agg.faturamento,
      positivados: agg.clientes_positivados,
      itens: agg.itens_vendidos,
      pedidos: agg.pedidos_realizados,
    }
  }, [sales, hierarchy, filteredSupervisores])

  const handleRowClick = (supervisorId: string) => {
    drillDown(nextTabInOrder('supervisao', availableTabs), {
      distribuidorId,
      gerenteId,
      supervisorId,
    })
  }

  if (!distribuidorId) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-muted-foreground">
          Selecione um distribuidor para visualizar a supervisão
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6 mt-4">
      {hierarchy && hierarchy.gerentes.length > 0 && (
        <FilterBar columns={2}>
          <FilterField label="Gerente">
            <Select
              value={gerenteId ?? 'todos'}
              onValueChange={(v) =>
                setFilter('gerenteId', v === 'todos' ? undefined : (v as string))
              }
            >
            <SelectTrigger className="h-8 w-full text-sm">
              <SelectValue placeholder="Todos">
                {gerenteId
                  ? hierarchyPersonLabel(hierarchy, gerenteId, 'Gerente')
                  : 'Todos'}
              </SelectValue>
            </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {hierarchy.gerentes.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>
        </FilterBar>
      )}

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
        entidades={filteredSupervisores}
        series={series}
        seriesAnterior={seriesAnterior}
        onEntidadeClick={handleRowClick}
      />

      <Card>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Supervisor</TableHead>
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
                    Nenhum supervisor encontrado
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
