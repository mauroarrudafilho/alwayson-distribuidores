import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, Search, Plus, MapPin, Phone, Mail } from 'lucide-react'
import { PageHeader } from '@/components/distribuidor/PageHeader'
import { StatusBadge } from '@/components/distribuidor/StatusBadge'
import { useDistribuidores } from '@/hooks/useDistribuidores'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
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
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ESTADOS_NORDESTE } from '@/types/distribuidor'
import type { EstadoNordeste } from '@/types/distribuidor'

export function DistribuidoresList() {
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
      <PageHeader
        title="Distribuidores"
        description="Gestão dos distribuidores parceiros"
        actions={
          <Button size="sm" className="h-8 text-xs">
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Novo Distribuidor
          </Button>
        }
      />

      <Card className="rounded-md border border-border/50 shadow-none mb-4">
        <CardContent className="p-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                Buscar
              </label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  className="h-8 text-xs shadow-none border-border/50 pl-7 placeholder:text-muted-foreground"
                  placeholder="Nome, CNPJ ou cidade..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                Estado
              </label>
              <Select value={estadoFilter} onValueChange={setEstadoFilter}>
                <SelectTrigger className="h-8 text-xs shadow-none border-border/50">
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
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                Status
              </label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 text-xs shadow-none border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                  <SelectItem value="em_analise">Em Análise</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-md border border-border/50 shadow-none">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border/50">
              <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground py-2 h-8">
                Distribuidor
              </TableHead>
              <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground py-2 h-8">
                CNPJ
              </TableHead>
              <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground py-2 h-8">
                Localização
              </TableHead>
              <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground py-2 h-8">
                Responsável
              </TableHead>
              <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground py-2 h-8">
                Contato
              </TableHead>
              <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground py-2 h-8">
                Status
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} className="border-border/30">
                  <TableCell className="py-1.5">
                    <Skeleton className="h-4 w-40" />
                  </TableCell>
                  <TableCell className="py-1.5">
                    <Skeleton className="h-4 w-28" />
                  </TableCell>
                  <TableCell className="py-1.5">
                    <Skeleton className="h-4 w-32" />
                  </TableCell>
                  <TableCell className="py-1.5">
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell className="py-1.5">
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell className="py-1.5">
                    <Skeleton className="h-4 w-16" />
                  </TableCell>
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
                <TableRow
                  key={dist.id}
                  className="hover:bg-muted/30 border-border/30 group"
                >
                  <TableCell className="py-1.5">
                    <Link
                      to={`/distribuidores/${dist.id}`}
                      className="text-xs font-medium text-foreground hover:text-primary transition-colors"
                    >
                      {dist.nome}
                    </Link>
                  </TableCell>
                  <TableCell className="py-1.5 text-xs text-muted-foreground tabular-nums">
                    {dist.cnpj}
                  </TableCell>
                  <TableCell className="py-1.5">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="w-3 h-3" />
                      {dist.cidade} - {dist.estado}
                    </span>
                  </TableCell>
                  <TableCell className="py-1.5 text-xs">
                    {dist.responsavel}
                  </TableCell>
                  <TableCell className="py-1.5">
                    <div className="flex items-center gap-2">
                      {dist.telefone && (
                        <Phone className="w-3 h-3 text-muted-foreground" />
                      )}
                      {dist.email && (
                        <Mail className="w-3 h-3 text-muted-foreground" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="py-1.5">
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
