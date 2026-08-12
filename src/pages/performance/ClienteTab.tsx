import { useMemo, useState } from 'react'
import { UserSearch } from 'lucide-react'
import { FilterBar, FilterField } from '@/components/distribuidor/FilterBar'
import { StatusBadge } from '@/components/distribuidor/StatusBadge'
import { ClienteResumoModal } from '@/components/cliente/ClienteResumoModal'
import { ClienteSinalizadores } from '@/components/cliente/ClienteSinalizadores'
import { useClientes } from '@/hooks/useClientes'
import { useClientesFaturamentoResumo } from '@/hooks/useClientesFaturamentoResumo'
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
import { formatCurrency, formatDate, formatCidadeUf } from '@/lib/format'
import { resolveClienteCidadeUf } from '@/lib/cliente-cidade'
import { useInsightsCidadesByCnpj } from '@/hooks/useInsightsCidadesByCnpj'
import { insightsCnpjKey } from '@/hooks/useInsightsQueries'
import { usePerformanceContext } from './PerformanceContext'
import { InsightsBadge } from '@/components/insights/InsightsBadge'
import { SortableNumericHead, useNumericSort } from './sortableNumeric'
import { hierarchyPersonLabel } from './hierarchyLabels'
import { ColunaEvolucao, calcularVariacaoLinha } from './ColunaEvolucao'
import { useSerieCliente } from '@/hooks/useSerieEntidade'
import { calcularJanela, calcularComparacao } from '@/lib/janela-periodo'
import type { ClienteDistribuidor } from '@/types/distribuidor'
import {
  CLASSIFICACAO_FILTRO_LABELS,
  clienteTemClassificacao,
  type ClassificacaoFiltro,
} from '@/lib/cliente-sinalizadores'

function normalizarBusca(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

function normalizarCnpj(s: string): string {
  return s.replace(/\D/g, '')
}

function clienteBateBusca(cliente: ClienteDistribuidor, query: string): boolean {
  const q = normalizarBusca(query)
  if (!q) return true
  const nomeMatch = normalizarBusca(
    `${cliente.razao_social} ${cliente.nome_fantasia ?? ''}`
  ).includes(q)
  const cnpjQuery = normalizarCnpj(query)
  const cnpjMatch = cnpjQuery.length > 0 && normalizarCnpj(cliente.cnpj).includes(cnpjQuery)
  return nomeMatch || cnpjMatch
}

export function ClienteTab() {
  const [selectedClienteId, setSelectedClienteId] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [classificacaoFiltro, setClassificacaoFiltro] = useState<
    ClassificacaoFiltro | 'todos'
  >('todos')
  const [cidadeFiltro, setCidadeFiltro] = useState<string | undefined>(undefined)
  const { filters, setFilter } = usePerformanceContext()
  const {
    distribuidorId,
    gerenteId,
    supervisorId,
    vendedorId,
    periodoInicio,
    periodoFim,
    metrica,
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

  const rowIds = useMemo(() => rows.map((r) => r.id), [rows])
  const rowCnpjs = useMemo(() => rows.map((r) => r.cnpj), [rows])
  const { cidadesMap } = useInsightsCidadesByCnpj(rowCnpjs)
  const { resumoMap, topIds } = useClientesFaturamentoResumo(
    distribuidorId,
    rowIds,
    periodoInicio,
    periodoFim
  )

  const cidadeOptions = useMemo(() => {
    const set = new Set<string>()
    for (const row of rows) {
      const resolved = resolveClienteCidadeUf(row, cidadesMap.get(insightsCnpjKey(row.cnpj)))
      if (resolved.cidade === '—') continue
      const label = formatCidadeUf(resolved.cidade, resolved.estado)
      if (label) set.add(label)
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [rows, cidadesMap])

  const rowsFiltrados = useMemo(() => {
    return rows.filter((row) => {
      if (!clienteBateBusca(row, busca)) return false

      if (classificacaoFiltro !== 'todos') {
        const resumo = resumoMap.get(row.id)
        if (
          !clienteTemClassificacao(
            classificacaoFiltro,
            row,
            resumo,
            topIds.has(row.id)
          )
        ) {
          return false
        }
      }

      if (cidadeFiltro) {
        const resolved = resolveClienteCidadeUf(
          row,
          cidadesMap.get(insightsCnpjKey(row.cnpj))
        )
        if (formatCidadeUf(resolved.cidade, resolved.estado) !== cidadeFiltro) {
          return false
        }
      }

      return true
    })
  }, [rows, busca, classificacaoFiltro, cidadeFiltro, resumoMap, topIds, cidadesMap])

  const janela = calcularJanela(filters.janela)
  const comparacao = calcularComparacao(janela, filters.comparar)
  const { data: series } = useSerieCliente(distribuidorId, janela)
  const { data: seriesAnterior } = useSerieCliente(
    distribuidorId,
    comparacao ?? janela
  )

  const variacaoMap = useMemo(() => {
    const map = new Map<string, number | null>()
    for (const row of rows) {
      map.set(
        row.id,
        calcularVariacaoLinha(
          series?.get(row.id),
          comparacao ? seriesAnterior?.get(row.id) : undefined
        )
      )
    }
    return map
  }, [rows, series, seriesAnterior, comparacao])

  const { sortField, sortDir, toggleSort } = useNumericSort<
    'faturamento_mes' | 'variacao'
  >('faturamento_mes')
  const sortedRows = useMemo(() => {
    return [...rowsFiltrados].sort((a, b) => {
      if (sortField === 'variacao') {
        const va = variacaoMap.get(a.id) ?? null
        const vb = variacaoMap.get(b.id) ?? null
        const na = va === null
        const nb = vb === null
        if (na && nb) return 0
        if (na) return 1   // nulos sempre no fim…
        if (nb) return -1  // …independentemente da direção
        const cmp = va - vb
        return sortDir === 'asc' ? cmp : -cmp
      }
      const ta = resumoMap.get(a.id)?.faturamentoPeriodo ?? 0
      const tb = resumoMap.get(b.id)?.faturamentoPeriodo ?? 0
      const cmp = ta - tb
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [rowsFiltrados, resumoMap, variacaoMap, sortField, sortDir])

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
    [showGerenteFilter, showSupervisorFilter, showVendedorFilter].filter(Boolean)
      .length + 2 // Classificação e Cidade sempre aparecem
  const filterColumns = Math.min(Math.max(filterCount, 2), 4) as 2 | 3 | 4

  return (
    <div className="space-y-6 mt-4">
      <ClienteResumoModal
        clienteId={selectedClienteId}
        open={selectedClienteId != null}
        onOpenChange={(open) => {
          if (!open) setSelectedClienteId(null)
        }}
        periodo={{ inicio: periodoInicio, fim: periodoFim }}
        metrica={metrica}
        distribuidorId={distribuidorId}
      />

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">
          Buscar
        </label>
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Nome, razão social ou CNPJ"
          className="h-8 w-full rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
        />
      </div>

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
                <SelectTrigger className="h-8 w-full text-sm">
                  <SelectValue placeholder="Todos">
                    {gerenteId
                      ? hierarchyPersonLabel(hierarchy, gerenteId, 'Gerente')
                      : 'Todos'}
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
          <FilterField label="Classificação">
            <Select
              value={classificacaoFiltro}
              onValueChange={(v) =>
                setClassificacaoFiltro(v as ClassificacaoFiltro | 'todos')
              }
            >
              <SelectTrigger className="h-8 w-full text-sm">
                <SelectValue placeholder="Todos">
                  {classificacaoFiltro === 'todos'
                    ? 'Todos'
                    : CLASSIFICACAO_FILTRO_LABELS[classificacaoFiltro]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {(Object.keys(CLASSIFICACAO_FILTRO_LABELS) as ClassificacaoFiltro[]).map(
                  (key) => (
                    <SelectItem key={key} value={key}>
                      {CLASSIFICACAO_FILTRO_LABELS[key]}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </FilterField>
          <FilterField label="Cidade / UF">
            <Select
              value={cidadeFiltro ?? 'todos'}
              onValueChange={(v) =>
                setCidadeFiltro(v === 'todos' ? undefined : (v as string))
              }
            >
              <SelectTrigger className="h-8 w-full text-sm">
                <SelectValue placeholder="Todos">
                  {cidadeFiltro ?? 'Todos'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {cidadeOptions.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>
        </FilterBar>

      <Card>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Nome</TableHead>
              <TableHead>CNPJ</TableHead>
              <TableHead>Cidade / UF</TableHead>
              <SortableNumericHead
                label="Faturamento (período)"
                field="faturamento_mes"
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
              <TableHead>Última Compra</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : rowsFiltrados.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center">
                  <UserSearch className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">
                    Nenhum cliente encontrado
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              sortedRows.map((row) => {
                const resumo = resumoMap.get(row.id)
                const ultimaCompra = resumo?.ultimaCompra
                const faturamentoMes = resumo?.faturamentoPeriodo ?? 0
                return (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => setSelectedClienteId(row.id)}
                >
                  <TableCell className="max-w-[min(100%,18rem)] text-xs font-medium">
                    <div className="space-y-1">
                      <span className="inline-flex min-w-0 items-center gap-1.5">
                        <span className="truncate">{row.nome_fantasia || row.razao_social}</span>
                        <InsightsBadge
                          cnpj={row.cnpj}
                          faturamentoLocal={resumo?.faturamentoPeriodo ?? null}
                          nfsLocais={resumo?.nfsPeriodo ?? null}
                          periodoAnalise={{ inicio: periodoInicio, fim: periodoFim }}
                          distribuidorId={distribuidorId}
                          metrica={metrica}
                        />
                      </span>
                      <ClienteSinalizadores
                        cliente={row}
                        resumo={resumo}
                        isTopComprador={topIds.has(row.id)}
                        compact
                        className="max-w-full"
                      />
                    </div>
                  </TableCell>
                  <TableCell className="text-xs tabular-nums text-muted-foreground">
                    {row.cnpj}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {(() => {
                      const resolved = resolveClienteCidadeUf(
                        row,
                        cidadesMap.get(insightsCnpjKey(row.cnpj))
                      )
                      const label = formatCidadeUf(resolved.cidade, resolved.estado)
                      return label || '—'
                    })()}
                  </TableCell>
                  <TableCell className="text-xs tabular-nums text-right font-medium">
                    {faturamentoMes > 0 ? formatCurrency(faturamentoMes) : '—'}
                  </TableCell>
                  <ColunaEvolucao
                    serie={series?.get(row.id)}
                    variacao={variacaoMap.get(row.id) ?? null}
                    className="hidden lg:table-cell"
                  />
                  <TableCell className="text-xs text-muted-foreground">
                    {ultimaCompra ? formatDate(ultimaCompra) : '—'}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={row.status} />
                  </TableCell>
                </TableRow>
              )})
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
