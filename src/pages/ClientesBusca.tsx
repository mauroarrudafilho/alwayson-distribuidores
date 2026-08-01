import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, MapPin, Search, Users } from 'lucide-react'
import { PageHeader } from '@/components/distribuidor/PageHeader'
import { FilterBar, FilterField } from '@/components/distribuidor/FilterBar'
import { EmptyState } from '@/components/distribuidor/EmptyState'
import { KPICard } from '@/components/distribuidor/KPICard'
import { KPIGrid } from '@/components/distribuidor/KPIGrid'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { PaginationBar } from '@/components/ui/pagination-bar'
import { useClientesBusca } from '@/hooks/useClientesBusca'
import { useInsightsCidadesByCnpj } from '@/hooks/useInsightsCidadesByCnpj'
import { insightsCnpjKey } from '@/hooks/useInsightsQueries'
import { resolveClienteCidadeUf } from '@/lib/cliente-cidade'
import { InsightsBadge } from '@/components/insights/InsightsBadge'
import { formatCnpj } from '@/lib/format'

export function ClientesBusca() {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [ufFilter, setUfFilter] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, ufFilter])

  const { data, isLoading } = useClientesBusca(debouncedSearch, ufFilter, page, pageSize)
  const rows = data?.rows ?? []
  const total = data?.total ?? 0
  const kpi = data?.kpi ?? { clientes: 0, ufs: 0, distribuidores: 0 }
  const ufOptions = data?.ufOptions ?? []

  const rowCnpjs = useMemo(() => rows.map((c) => c.cnpj), [rows])
  const { cidadesMap } = useInsightsCidadesByCnpj(rowCnpjs)

  const showEmptyState = !isLoading && total === 0
  const showResults = isLoading || total > 0

  return (
    <div className="animate-page-in">
      <PageHeader
        title="Clientes"
        accent="por recorte"
        description="consulta detalhada"
      />

      <FilterBar columns={2}>
        <FilterField label="Buscar CNPJ, razão social ou nome fantasia">
          <InputGroup className="h-9">
            <InputGroupAddon>
              <Search className="h-4 w-4" />
            </InputGroupAddon>
            <InputGroupInput
              placeholder="CNPJ, razão social ou nome fantasia…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </InputGroup>
        </FilterField>
        <FilterField label="Estado">
          <div className="flex flex-wrap gap-1.5">
            <Button
              size="sm"
              variant={ufFilter === '' ? 'default' : 'outline'}
              className="h-8 text-xs"
              onClick={() => setUfFilter('')}
            >
              Todos
            </Button>
            {ufOptions.map((uf) => (
              <Button
                key={uf}
                size="sm"
                variant={ufFilter === uf ? 'default' : 'outline'}
                className="h-8 text-xs"
                onClick={() => setUfFilter(uf)}
              >
                {uf}
              </Button>
            ))}
          </div>
        </FilterField>
      </FilterBar>

      {(total > 0 || isLoading) && (
        <KPIGrid columns={3} className="mb-6">
          <KPICard label="Clientes cadastrados" value={kpi.clientes} icon={Users} />
          <KPICard label="Estados" value={kpi.ufs} icon={MapPin} />
          <KPICard label="Distribuidores" value={kpi.distribuidores} icon={Building2} />
        </KPIGrid>
      )}

      {showEmptyState && (
        <EmptyState
          icon={Search}
          title={debouncedSearch ? 'Nenhum cliente encontrado' : 'Nenhum cliente carregado'}
          description={
            debouncedSearch
              ? `Sem resultados para "${debouncedSearch}"${ufFilter ? ` em ${ufFilter}` : ''}. Ajuste a busca ou o filtro de UF.`
              : 'A base ainda não tem clientes neste recorte.'
          }
        />
      )}

      {showResults && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome Fantasia</TableHead>
                  <TableHead>Razão Social</TableHead>
                  <TableHead className="font-mono text-xs">CNPJ</TableHead>
                  <TableHead className="w-12 text-center">UF</TableHead>
                  <TableHead>Cidade</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      </TableRow>
                    ))
                  : rows.map((c) => {
                      const local = resolveClienteCidadeUf(
                        c,
                        cidadesMap.get(insightsCnpjKey(c.cnpj))
                      )
                      return (
                        <TableRow key={c.id} className="cursor-pointer">
                          <TableCell>
                            <span className="inline-flex items-center gap-1.5">
                              <Link
                                to={`/clientes/${c.id}`}
                                className="text-sm font-medium text-foreground hover:text-primary transition-colors"
                              >
                                {c.nome_fantasia || '—'}
                              </Link>
                              <InsightsBadge cnpj={c.cnpj} />
                            </span>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {c.razao_social}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground tabular-nums">
                            {formatCnpj(c.cnpj)}
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="inline-flex h-[18px] items-center rounded border border-border/60 px-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                              {local.estado !== '—' ? local.estado : '—'}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {local.cidade !== '—' ? local.cidade : '—'}
                          </TableCell>
                        </TableRow>
                      )
                    })}
              </TableBody>
            </Table>
            {!isLoading && total > 0 && (
              <PaginationBar
                page={page}
                pageSize={pageSize}
                total={total}
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                  setPageSize(size)
                  setPage(1)
                }}
              />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
