import { useState, useMemo } from 'react'
import { Package, Search } from 'lucide-react'
import { StatusBadge } from '@/components/distribuidor/StatusBadge'
import { FilterBar, FilterField } from '@/components/distribuidor/FilterBar'
import { useProdutos } from '@/hooks/useProdutos'
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
import { formatCurrency } from '@/lib/format'

export function AdminProdutos() {
  const { data: produtos, isLoading } = useProdutos()
  const [search, setSearch] = useState('')
  const [categoriaFilter, setCategoriaFilter] = useState<string>('todas')
  const [statusFilter, setStatusFilter] = useState<string>('todos')

  const categorias = useMemo(() => {
    const cats = new Set<string>()
    ;(produtos ?? []).forEach((p) => {
      if (p.categoria) cats.add(p.categoria)
    })
    return Array.from(cats).sort()
  }, [produtos])

  const filtered = (produtos ?? []).filter((p) => {
    const matchSearch =
      !search ||
      p.sku.toLowerCase().includes(search.toLowerCase()) ||
      p.descricao.toLowerCase().includes(search.toLowerCase())
    const matchCategoria =
      categoriaFilter === 'todas' || p.categoria === categoriaFilter
    const matchStatus =
      statusFilter === 'todos' ||
      (statusFilter === 'ativo' && p.ativo) ||
      (statusFilter === 'inativo' && !p.ativo)
    return matchSearch && matchCategoria && matchStatus
  })

  return (
    <div>
      <FilterBar>
        <FilterField label="Buscar">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="h-8 text-sm pl-8 placeholder:text-muted-foreground"
              placeholder="SKU ou descrição..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </FilterField>
        <FilterField label="Categoria">
          <Select
            value={categoriaFilter}
            onValueChange={(v) => setCategoriaFilter(v ?? 'todas')}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              {categorias.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label="Status">
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v ?? 'todos')}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="inativo">Inativo</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>
      </FilterBar>

      <Card>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>SKU</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Preço Ref.</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-40" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-28" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-16" />
                  </TableCell>
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center">
                  <Package className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">
                    Nenhum produto encontrado
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-xs font-medium tabular-nums">
                    {p.sku}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {p.descricao}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {p.categoria ?? '-'}
                  </TableCell>
                  <TableCell className="text-xs tabular-nums">
                    {p.preco_referencia != null
                      ? formatCurrency(p.preco_referencia)
                      : '-'}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={p.ativo ? 'ativo' : 'inativo'} />
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
