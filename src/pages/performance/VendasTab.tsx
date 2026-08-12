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
import { SortableNumericHead, useSortedMetricRows } from './sortableNumeric'
import { hierarchyPersonLabel } from './hierarchyLabels'
import { ColunaEvolucao, calcularVariacaoLinha } from './ColunaEvolucao'
import { useSerieHierarquia } from '@/hooks/useSerieEntidade'
import { calcularJanela, calcularComparacao } from '@/lib/janela-periodo'
import { EvolucaoGraficoNivel } from './EvolucaoGraficoNivel'

export function VendasTab() {
  const { filters, setFilter, drillDown } = usePerformanceContext()
  const {
    distribuidorId,
    gerenteId,
    supervisorId,
    periodoInicio,
    periodoFim,
  } = filters

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
  const { data: series } = useSerieHierarquia(filters.distribuidorId, 'vendedor', janela)
  const { data: seriesAnterior } = useSerieHierarquia(
    filters.distribuidorId,
    'vendedor',
    comparacao ?? janela
  )

  const supervisoresForFilter = useMemo(() => {
    if (!hierarchy) return []
    if (gerenteId) {
      return hierarchy.supervisores.filter(
        (s) => s.supervisor_id === gerenteId
      )
    }
    return hierarchy.supervisores
  }, [hierarchy, gerenteId])

  const filteredVendedores = useMemo(() => {
    if (!hierarchy) return []
    let list = hierarchy.vendedoresOnly

    if (supervisorId) {
      list = list.filter((v) => v.supervisor_id === supervisorId)
    } else if (gerenteId) {
      const subIds = hierarchy.getSubordinateIds(gerenteId)
      list = list.filter((v) => subIds.includes(v.id))
    }

    return list
  }, [hierarchy, supervisorId, gerenteId])

  const rows = useMemo(() => {
    return filteredVendedores.map((vendedor) => {
      const scoped = sales.filter((s) => s.vendedor_id === vendedor.id)
      const agg = aggregateSales(scoped)
      const faturamento = agg.faturamento
      const positivados = agg.clientes_positivados
      const itens = agg.itens_vendidos
      const pedidos = agg.pedidos_realizados
      return {
        ...vendedor,
        faturamento,
        positivados,
        itens,
        pedidos,
        variacao: calcularVariacaoLinha(
          series?.get(vendedor.id),
          comparacao ? seriesAnterior?.get(vendedor.id) : undefined
        ),
      }
    })
  }, [sales, filteredVendedores, series, seriesAnterior, comparacao])

  const { sortedRows, sortField, sortDir, toggleSort } = useSortedMetricRows(rows)

  const totals = useMemo(() => {
    const ids = new Set(filteredVendedores.map((v) => v.id))
    const scoped = sales.filter((s) => ids.has(s.vendedor_id))
    const agg = aggregateSales(scoped)
    return {
      faturamento: agg.faturamento,
      positivados: agg.clientes_positivados,
      itens: agg.itens_vendidos,
      pedidos: agg.pedidos_realizados,
    }
  }, [sales, filteredVendedores])

  const handleRowClick = (vendedorId: string) => {
    drillDown('cliente', {
      distribuidorId,
      gerenteId,
      supervisorId,
      vendedorId,
    })
  }

  if (!distribuidorId) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-muted-foreground">
          Selecione um distribuidor para visualizar vendedores
        </p>
      </div>
    )
  }

  const showSupervisorFilter = supervisoresForFilter.length > 0

  return (
    <div className="space-y-6 mt-4">
      {showSupervisorFilter && (
        <FilterBar columns={2}>
          <FilterField label="Supervisor">
            <Select
              value={supervisorId ?? 'todos'}
              onValueChange={(v) =>
                setFilter(
                  'supervisorId',
                  v === 'todos' ? undefined : (v as string)
                )
              }
            >
              <SelectTrigger className="h-8 w-full text-sm">
                <SelectValue placeholder="Todos">
                  {supervisorId
                    ? hierarchyPersonLabel(hierarchy, supervisorId, 'Supervisor')
                    : 'Todos'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {supervisoresForFilter.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.nome}
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
        entidades={filteredVendedores}
        series={series}
        seriesAnterior={seriesAnterior}
        onEntidadeClick={handleRowClick}
      />

      <Card>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Vendedor</TableHead>
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
              Array.from({ length: 5 }).map((_, i) => (
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
                    Nenhum vendedor encontrado
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
