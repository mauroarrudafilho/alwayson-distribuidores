import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, MapPin, Search, Users } from 'lucide-react'
import { PageHeader } from '@/components/distribuidor/PageHeader'
import { FilterBar, FilterField } from '@/components/distribuidor/FilterBar'
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
import { usePagination } from '@/hooks/usePagination'
import { InsightsBadge } from '@/components/insights/InsightsBadge'
import { formatCnpj } from '@/lib/format'

export function ClientesBusca() {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [ufFilter, setUfFilter] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(timer)
  }, [search])

  const { data: clientes, isLoading } = useClientesBusca(debouncedSearch)

  const ufs = useMemo(() => {
    const set = new Set<string>()
    for (const c of clientes ?? []) {
      const uf = (c.estado ?? '').trim()
      if (uf) set.add(uf)
    }
    return [...set].sort()
  }, [clientes])

  const filtered = useMemo(() => {
    if (!clientes) return []
    if (!ufFilter) return clientes
    return clientes.filter((c) => c.estado === ufFilter)
  }, [clientes, ufFilter])

  const kpis = useMemo(() => {
    const distribuidores = new Set<string>()
    for (const c of filtered) {
      if (c.distribuidor_id) distribuidores.add(c.distribuidor_id)
    }
    return {
      total: filtered.length,
      ufs: new Set(filtered.map((c) => c.estado).filter(Boolean)).size,
      distribuidores: distribuidores.size,
    }
  }, [filtered])

  const pag = usePagination({
    items: filtered,
    initialPageSize: 25,
    resetKey: `${debouncedSearch}|${ufFilter}`,
  })

  const showEmptyState = !isLoading && filtered.length === 0
  const showResults = isLoading || filtered.length > 0

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow="AlwaysOn · Distribuidores"
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
              placeholder="Bar do Zé, 11.111.111…"
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
            {ufs.map((uf) => (
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

      {(filtered.length > 0 || isLoading) && (
        <KPIGrid columns={3} className="mb-6">
          <KPICard label="Clientes encontrados" value={kpis.total} icon={Users} />
          <KPICard label="Estados" value={kpis.ufs} icon={MapPin} />
          <KPICard label="Distribuidores" value={kpis.distribuidores} icon={Building2} />
        </KPIGrid>
      )}

      {showEmptyState && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Search className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">
              {debouncedSearch
                ? `Nenhum cliente encontrado para "${debouncedSearch}"${ufFilter ? ` em ${ufFilter}` : ''}.`
                : 'Nenhum cliente carregado.'}
            </p>
          </CardContent>
        </Card>
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
                  : pag.paginated.map((c) => (
                      <TableRow
                        key={c.id}
                        className="cursor-pointer"
                      >
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
                            {c.estado}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {c.cidade}
                        </TableCell>
                      </TableRow>
                    ))}
              </TableBody>
            </Table>
            {!isLoading && filtered.length > 0 && (
              <PaginationBar
                page={pag.page}
                pageSize={pag.pageSize}
                total={pag.total}
                onPageChange={pag.setPage}
                onPageSizeChange={pag.setPageSize}
              />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
