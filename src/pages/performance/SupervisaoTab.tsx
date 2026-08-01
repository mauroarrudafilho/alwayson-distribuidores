import { useMemo } from 'react'
import { DollarSign, Users, ShoppingCart, Target } from 'lucide-react'
import { KPICard } from '@/components/distribuidor/KPICard'
import { KPIGrid } from '@/components/distribuidor/KPIGrid'
import { MetaProgressBar } from '@/components/distribuidor/MetaProgressBar'
import { FilterBar, FilterField } from '@/components/distribuidor/FilterBar'
import {
  useVendedorHierarchy,
  useMetasByLevel,
} from '@/hooks/usePerformanceHierarchy'
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

export function SupervisaoTab() {
  const { filters, setFilter, drillDown } = usePerformanceContext()
  const { distribuidorId, gerenteId, periodoInicio, periodoFim } = filters

  const { data: hierarchy, isLoading: loadingHierarchy } =
    useVendedorHierarchy(distribuidorId)
  const { data: sales = [], isLoading: loadingPerf } = useFaturamentoSales(
    distribuidorId,
    periodoInicio,
    periodoFim
  )
  const { data: metas } = useMetasByLevel(distribuidorId, 'supervisor')

  const isLoading = loadingHierarchy || loadingPerf

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
      }
    })
  }, [hierarchy, sales, filteredSupervisores])

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

  const metaFaturamento = useMemo(() => {
    const m = (metas ?? []).find((meta) => meta.tipo === 'faturamento')
    if (!m) return null
    return {
      meta: Number(m.valor_meta),
      realizado: Number(m.valor_realizado),
      percentual: Number(m.percentual_atingimento),
    }
  }, [metas])

  const handleRowClick = (supervisorId: string) => {
    drillDown('vendas', { distribuidorId, gerenteId, supervisorId })
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
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
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
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
