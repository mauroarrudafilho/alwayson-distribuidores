import { useState } from 'react'
import { Package, AlertTriangle, CheckCircle2, TrendingUp } from 'lucide-react'
import { PageHeader } from '@/components/distribuidor/PageHeader'
import { KPICard } from '@/components/distribuidor/KPICard'
import { KPIGrid } from '@/components/distribuidor/KPIGrid'
import { StatusBadge } from '@/components/distribuidor/StatusBadge'
import { FilterBar, FilterField } from '@/components/distribuidor/FilterBar'
import { useEstoque } from '@/hooks/useEstoque'
import { useDistribuidores } from '@/hooks/useDistribuidores'
import { Card } from '@/components/ui/card'
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
import { Skeleton } from '@/components/ui/skeleton'

export function EstoquePanel() {
  const [distribuidorFilter, setDistribuidorFilter] = useState<string>('todos')
  const [periodoInicio, setPeriodoInicio] = useState<string>('')
  const [periodoFim, setPeriodoFim] = useState<string>('')
  const { data: distribuidores } = useDistribuidores()
  const { data: estoque, isLoading } = useEstoque(
    distribuidorFilter === 'todos' ? undefined : distribuidorFilter
  )

  const items = estoque ?? []
  const total = items.length
  const saudaveis = items.filter((e) => e.status === 'saudavel').length
  const criticos = items.filter((e) => e.status === 'critico').length
  const overstock = items.filter((e) => e.status === 'overstock').length

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Estoque"
        description="Posição de estoque dos distribuidores"
      />

      <FilterBar>
        <FilterField label="Distribuidor">
          <Select value={distribuidorFilter} onValueChange={(v) => setDistribuidorFilter(v ?? 'todos')}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {(distribuidores ?? []).map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label="Período Início">
          <Input
            type="month"
            value={periodoInicio}
            onChange={(e) => setPeriodoInicio(e.target.value)}
            className="h-8 text-sm"
          />
        </FilterField>
        <FilterField label="Período Fim">
          <Input
            type="month"
            value={periodoFim}
            onChange={(e) => setPeriodoFim(e.target.value)}
            className="h-8 text-sm"
          />
        </FilterField>
      </FilterBar>

      <KPIGrid columns={4}>
        <KPICard label="Total SKUs" value={total} icon={Package} />
        <KPICard label="Saudável" value={saudaveis} icon={CheckCircle2} />
        <KPICard label="Crítico" value={criticos} icon={AlertTriangle} />
        <KPICard label="Overstock" value={overstock} icon={TrendingUp} />
      </KPIGrid>

      <Card className="mt-6">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>SKU</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="text-right">Quantidade</TableHead>
              <TableHead className="text-right">Est. Mínimo</TableHead>
              <TableHead className="text-right">Dias Cobertura</TableHead>
              <TableHead className="text-right">Sugestão Pedido</TableHead>
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
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center">
                  <Package className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">
                    Nenhum item de estoque
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="text-xs font-medium tabular-nums">
                    {item.sku}
                  </TableCell>
                  <TableCell className="text-xs">{item.descricao}</TableCell>
                  <TableCell className="text-xs tabular-nums text-right">
                    {Number(item.quantidade_atual).toLocaleString('pt-BR')}
                  </TableCell>
                  <TableCell className="text-xs tabular-nums text-right">
                    {Number(item.estoque_minimo_calculado ?? item.quantidade_minima).toLocaleString('pt-BR')}
                  </TableCell>
                  <TableCell className="text-xs tabular-nums text-right">
                    {Number(item.dias_cobertura).toFixed(0)}d
                  </TableCell>
                  <TableCell className="text-xs tabular-nums text-right">
                    {item.sugestao_pedido
                      ? Number(item.sugestao_pedido).toLocaleString('pt-BR')
                      : '—'}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={item.status} />
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
