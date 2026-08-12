import { useMemo } from 'react'
import { FilterBar, FilterField } from '@/components/distribuidor/FilterBar'
import { useVendedorHierarchy } from '@/hooks/usePerformanceHierarchy'
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
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/format'
import { usePerformanceContext } from './PerformanceContext'
import { SortableNumericHead, useSortedMetricRows } from './sortableNumeric'
import { hierarchyPersonLabel } from './hierarchyLabels'
import { ColunaEvolucao, calcularVariacaoLinha } from './ColunaEvolucao'
import { useSerieProduto, montarSeriesProduto } from '@/hooks/useSerieProduto'
import { calcularJanela, calcularComparacao } from '@/lib/janela-periodo'
import { EvolucaoGraficoNivel } from './EvolucaoGraficoNivel'

export function ProdutoTab() {
  const { filters, setFilter } = usePerformanceContext()
  const { distribuidorId, gerenteId, supervisorId, vendedorId } = filters

  const { data: hierarchy, isLoading: loadingHierarchy } =
    useVendedorHierarchy(distribuidorId)

  const janela = calcularJanela(filters.janela)
  const comparacao = calcularComparacao(janela, filters.comparar)
  const { data: linhas, isLoading: loadingSerie } = useSerieProduto(distribuidorId, janela)
  const { data: linhasAnterior } = useSerieProduto(distribuidorId, comparacao ?? janela)

  const isLoading = loadingHierarchy || loadingSerie

  const gerentesForFilter = useMemo(() => hierarchy?.gerentes ?? [], [hierarchy])

  const supervisoresForFilter = useMemo(() => {
    if (!hierarchy) return []
    if (gerenteId) {
      return hierarchy.supervisores.filter((s) => s.supervisor_id === gerenteId)
    }
    return hierarchy.supervisores
  }, [hierarchy, gerenteId])

  const vendedoresForFilter = useMemo(() => {
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

  const vendedorIdsPermitidos = useMemo(() => {
    if (!hierarchy) return null
    if (vendedorId) return new Set([vendedorId])
    if (supervisorId) {
      return new Set([supervisorId, ...hierarchy.getSubordinateIds(supervisorId)])
    }
    if (gerenteId) {
      return new Set([gerenteId, ...hierarchy.getSubordinateIds(gerenteId)])
    }
    return null
  }, [hierarchy, gerenteId, supervisorId, vendedorId])

  const { series, nomes } = useMemo(
    () => montarSeriesProduto(linhas ?? [], janela, vendedorIdsPermitidos),
    [linhas, janela, vendedorIdsPermitidos]
  )
  const { series: seriesAnterior } = useMemo(
    () => montarSeriesProduto(linhasAnterior ?? [], comparacao ?? janela, vendedorIdsPermitidos),
    [linhasAnterior, comparacao, janela, vendedorIdsPermitidos]
  )

  const entidades = useMemo(
    () => Array.from(nomes.entries()).map(([id, nome]) => ({ id, nome })),
    [nomes]
  )

  const rows = useMemo(() => {
    return entidades.map((entidade) => {
      const serie = series.get(entidade.id)
      return {
        id: entidade.id,
        nome: entidade.nome,
        faturamento: serie?.total ?? 0,
        variacao: calcularVariacaoLinha(
          serie,
          comparacao ? seriesAnterior.get(entidade.id) : undefined
        ),
      }
    })
  }, [entidades, series, seriesAnterior, comparacao])

  const { sortedRows, sortField, sortDir, toggleSort } = useSortedMetricRows(rows)

  if (!distribuidorId) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-muted-foreground">
          Selecione um distribuidor para visualizar produtos
        </p>
      </div>
    )
  }

  const showGerenteFilter = gerentesForFilter.length > 0
  const showSupervisorFilter = supervisoresForFilter.length > 0
  const showVendedorFilter = vendedoresForFilter.length > 0
  const filterCount = [showGerenteFilter, showSupervisorFilter, showVendedorFilter].filter(
    Boolean
  ).length
  const filterColumns = Math.min(Math.max(filterCount, 2), 4) as 2 | 3 | 4

  return (
    <div className="space-y-6 mt-4">
      {filterCount > 0 && (
        <FilterBar columns={filterColumns}>
          {showGerenteFilter && (
            <FilterField label="Gerente">
              <Select
                value={gerenteId ?? 'todos'}
                onValueChange={(v) =>
                  setFilter('gerenteId', v === 'todos' ? undefined : (v as string))
                }
              >
                <SelectTrigger className="h-8 w-full text-sm">
                  <SelectValue placeholder="Todos">
                    {gerenteId ? hierarchyPersonLabel(hierarchy, gerenteId, 'Gerente') : 'Todos'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {gerentesForFilter.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>
          )}
          {showSupervisorFilter && (
            <FilterField label="Supervisor">
              <Select
                value={supervisorId ?? 'todos'}
                onValueChange={(v) =>
                  setFilter('supervisorId', v === 'todos' ? undefined : (v as string))
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
          )}
          {showVendedorFilter && (
            <FilterField label="Vendedor">
              <Select
                value={vendedorId ?? 'todos'}
                onValueChange={(v) =>
                  setFilter('vendedorId', v === 'todos' ? undefined : (v as string))
                }
              >
                <SelectTrigger className="h-8 w-full text-sm">
                  <SelectValue placeholder="Todos">
                    {vendedorId
                      ? hierarchyPersonLabel(hierarchy, vendedorId, 'Vendedor')
                      : 'Todos'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {vendedoresForFilter.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>
          )}
        </FilterBar>
      )}

      <EvolucaoGraficoNivel
        janela={janela}
        comparacao={comparacao}
        entidades={entidades}
        series={series}
        seriesAnterior={seriesAnterior}
        onEntidadeClick={() => {}}
      />

      <Card>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>SKU</TableHead>
              <SortableNumericHead
                label="Faturamento"
                field="faturamento"
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
            ) : sortedRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="py-8 text-center">
                  <p className="text-xs text-muted-foreground">Nenhum produto encontrado</p>
                </TableCell>
              </TableRow>
            ) : (
              sortedRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-xs font-medium">
                    <span className="font-mono">{row.id}</span>
                    <p className="text-[11px] font-normal text-muted-foreground">{row.nome}</p>
                  </TableCell>
                  <TableCell className="text-xs tabular-nums text-right">
                    {formatCurrency(row.faturamento)}
                  </TableCell>
                  <ColunaEvolucao serie={series.get(row.id)} variacao={row.variacao} />
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
