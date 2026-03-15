import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'
import { PageHeader } from '@/components/distribuidor/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
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
import { useClientesBusca } from '@/hooks/useClientesBusca'

export function ClientesBusca() {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(timer)
  }, [search])

  const { data: clientes, isLoading } = useClientesBusca(debouncedSearch)

  const showEmptyState = !isLoading && clientes?.length === 0
  const showResults = isLoading || (clientes && clientes.length > 0)

  return (
    <div className="animate-fade-in">
      <PageHeader title="Clientes" description="Consulta detalhada por cliente" />

      <InputGroup className="mb-6 h-10">
        <InputGroupAddon>
          <Search className="h-4 w-4" />
        </InputGroupAddon>
        <InputGroupInput
          placeholder="Buscar por CNPJ, razão social ou nome fantasia..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </InputGroup>

      {showEmptyState && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Search className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">
              Nenhum cliente encontrado para "{debouncedSearch}"
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
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Cidade-UF</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    </TableRow>
                  ))
                ) : (
                  clientes?.map((c) => (
                    <TableRow key={c.id} className="cursor-pointer">
                      <TableCell>
                        <Link
                          to={`/clientes/${c.id}`}
                          className="block text-foreground hover:text-primary transition-colors"
                        >
                          {c.nome_fantasia || '—'}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link to={`/clientes/${c.id}`} className="block">
                          {c.razao_social}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link to={`/clientes/${c.id}`} className="block font-mono text-xs">
                          {c.cnpj}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link to={`/clientes/${c.id}`} className="block">
                          {c.cidade}-{c.estado}
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
