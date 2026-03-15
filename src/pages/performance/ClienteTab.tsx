import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserSearch } from 'lucide-react'
import { FilterBar, FilterField } from '@/components/distribuidor/FilterBar'
import { StatusBadge } from '@/components/distribuidor/StatusBadge'
import { useClientes } from '@/hooks/useClientesExcelencia'
import { useVendedorHierarchy } from '@/hooks/usePerformanceHierarchy'
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
import { formatCurrency, formatDate } from '@/lib/format'
import { usePerformanceContext } from './PerformanceContext'

export function ClienteTab() {
  const navigate = useNavigate()
  const { filters, setFilter } = usePerformanceContext()
  const {
    distribuidorId,
    gerenteId,
    supervisorId,
    vendedorId,
  } = filters

  const { data: clientes, isLoading } = useClientes(distribuidorId)
  const { data: hierarchy } = useVendedorHierarchy(distribuidorId)

  const gerentesForFilter = useMemo(
    () => hierarchy?.gerentes ?? [],
    [hierarchy]
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

  const rows = useMemo(() => {
    if (!clientes) return []
    let filtered = clientes

    if (vendedorId) {
      filtered = filtered.filter((c) => c.vendedor_id === vendedorId)
    } else if (supervisorId && hierarchy) {
      const subIds = hierarchy.getSubordinateIds(supervisorId)
      const allIds = [supervisorId, ...subIds]
      filtered = filtered.filter(
        (c) => c.vendedor_id && allIds.includes(c.vendedor_id)
      )
    } else if (gerenteId && hierarchy) {
      const subIds = hierarchy.getSubordinateIds(gerenteId)
      const allIds = [gerenteId, ...subIds]
      filtered = filtered.filter(
        (c) => c.vendedor_id && allIds.includes(c.vendedor_id)
      )
    }

    return filtered
  }, [clientes, vendedorId, supervisorId, gerenteId, hierarchy])

  if (!distribuidorId) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-muted-foreground">
          Selecione um distribuidor para visualizar clientes
        </p>
      </div>
    )
  }

  const showGerenteFilter = gerentesForFilter.length > 0
  const showSupervisorFilter = supervisoresForFilter.length > 0
  const showVendedorFilter = vendedoresForFilter.length > 0
  const filterCount =
    [showGerenteFilter, showSupervisorFilter, showVendedorFilter].filter(
      Boolean
    ).length
  const filterColumns = Math.max(filterCount, 2) as 2 | 3 | 4

  return (
    <div className="space-y-6 mt-4">
      {filterCount > 0 && (
        <FilterBar columns={filterColumns}>
          {showGerenteFilter && (
            <FilterField label="Gerente">
              <Select
                value={gerenteId ?? 'todos'}
                onValueChange={(v) =>
                  setFilter(
                    'gerenteId',
                    v === 'todos' ? undefined : (v as string)
                  )
                }
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
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
                  setFilter(
                    'supervisorId',
                    v === 'todos' ? undefined : (v as string)
                  )
                }
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
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
                  setFilter(
                    'vendedorId',
                    v === 'todos' ? undefined : (v as string)
                  )
                }
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
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

      <Card>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Nome</TableHead>
              <TableHead>CNPJ</TableHead>
              <TableHead>Cidade</TableHead>
              <TableHead className="text-right">Ticket Médio</TableHead>
              <TableHead>Última Compra</TableHead>
              <TableHead>Status</TableHead>
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
                  <UserSearch className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">
                    Nenhum cliente encontrado
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/clientes/${row.id}`)}
                >
                  <TableCell className="text-xs font-medium">
                    {row.nome_fantasia || row.razao_social}
                  </TableCell>
                  <TableCell className="text-xs tabular-nums text-muted-foreground">
                    {row.cnpj}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {row.cidade} - {row.estado}
                  </TableCell>
                  <TableCell className="text-xs tabular-nums text-right">
                    {row.ticket_medio
                      ? formatCurrency(Number(row.ticket_medio))
                      : '—'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {row.ultima_compra
                      ? formatDate(row.ultima_compra)
                      : '—'}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={row.status} />
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
