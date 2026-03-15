import { useState } from 'react'
import { Building2, Search, MapPin, Phone, Mail } from 'lucide-react'
import { StatusBadge } from '@/components/distribuidor/StatusBadge'
import { FilterBar, FilterField } from '@/components/distribuidor/FilterBar'
import { useDistribuidores } from '@/hooks/useDistribuidores'
import { Input } from '@/components/ui/input'
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
import { ESTADOS_NORDESTE } from '@/types/distribuidor'

export function AdminDistribuidores() {
  const { data: distribuidores, isLoading } = useDistribuidores()
  const [search, setSearch] = useState('')
  const [estadoFilter, setEstadoFilter] = useState<string>('todos')
  const [statusFilter, setStatusFilter] = useState<string>('todos')

  const filtered = (distribuidores ?? []).filter((d) => {
    const matchSearch =
      !search ||
      d.nome.toLowerCase().includes(search.toLowerCase()) ||
      d.cnpj.includes(search) ||
      d.cidade.toLowerCase().includes(search.toLowerCase())
    const matchEstado = estadoFilter === 'todos' || d.estado === estadoFilter
    const matchStatus = statusFilter === 'todos' || d.status === statusFilter
    return matchSearch && matchEstado && matchStatus
  })

  return (
    <div>
      <FilterBar>
        <FilterField label="Buscar">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="h-8 text-sm pl-8 placeholder:text-muted-foreground"
              placeholder="Nome, CNPJ ou cidade..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </FilterField>
        <FilterField label="Estado">
          <Select value={estadoFilter} onValueChange={(v) => setEstadoFilter(v ?? 'todos')}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os estados</SelectItem>
              {ESTADOS_NORDESTE.map((e) => (
                <SelectItem key={e.value} value={e.value}>
                  {e.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label="Status">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? 'todos')}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="inativo">Inativo</SelectItem>
              <SelectItem value="em_analise">Em Analise</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>
      </FilterBar>

      <Card>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Distribuidor</TableHead>
              <TableHead>CNPJ</TableHead>
              <TableHead>Localização</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center">
                  <Building2 className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">
                    Nenhum distribuidor encontrado
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((dist) => (
                <TableRow key={dist.id}>
                  <TableCell className="text-xs font-medium">
                    {dist.nome}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground tabular-nums">
                    {dist.cnpj}
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="w-3.5 h-3.5" />
                      {dist.cidade} - {dist.estado}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs">
                    {dist.responsavel}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {dist.telefone && (
                        <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                      )}
                      {dist.email && (
                        <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={dist.status} />
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
