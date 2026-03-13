import { useState } from 'react'
import { Package, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import { PageHeader } from '@/components/distribuidor/PageHeader'
import { KPICard } from '@/components/distribuidor/KPICard'
import { KPIGrid } from '@/components/distribuidor/KPIGrid'
import { StatusBadge } from '@/components/distribuidor/StatusBadge'
import { useEstoque } from '@/hooks/useEstoque'
import { useDistribuidores } from '@/hooks/useDistribuidores'
import { Card, CardContent } from '@/components/ui/card'
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
  const { data: distribuidores } = useDistribuidores()
  const { data: estoque, isLoading } = useEstoque(
    distribuidorFilter === 'todos' ? undefined : distribuidorFilter
  )

  const items = estoque ?? []
  const total = items.length
  const normais = items.filter((e) => e.status === 'normal').length
  const baixos = items.filter((e) => e.status === 'baixo').length
  const criticos = items.filter(
    (e) => e.status === 'critico' || e.status === 'ruptura'
  ).length

  return (
    <div>
      <PageHeader
        title="Estoque"
        description="Posição de estoque dos distribuidores"
      />

      <Card className="rounded-md border border-border/50 shadow-none mb-4">
        <CardContent className="p-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                Distribuidor
              </label>
              <Select value={distribuidorFilter} onValueChange={(v) => setDistribuidorFilter(v ?? 'todos')}>
                <SelectTrigger className="h-8 text-xs shadow-none border-border/50">
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
            </div>
          </div>
        </CardContent>
      </Card>

      <KPIGrid columns={4}>
        <KPICard label="Total Itens" value={total} icon={Package} />
        <KPICard label="Normal" value={normais} icon={CheckCircle2} />
        <KPICard label="Baixo" value={baixos} icon={AlertTriangle} />
        <KPICard label="Crítico / Ruptura" value={criticos} icon={XCircle} />
      </KPIGrid>

      <Card className="rounded-md border border-border/50 shadow-none mt-4">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border/50">
              <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground py-2 h-8">
                SKU
              </TableHead>
              <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground py-2 h-8">
                Descrição
              </TableHead>
              <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground py-2 h-8 text-right">
                Quantidade
              </TableHead>
              <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground py-2 h-8 text-right">
                Dias Cobertura
              </TableHead>
              <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground py-2 h-8 text-right">
                Sugestão Pedido
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
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j} className="py-1.5">
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center">
                  <Package className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">
                    Nenhum item de estoque
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id} className="hover:bg-muted/30 border-border/30">
                  <TableCell className="py-1.5 text-xs font-medium tabular-nums">
                    {item.sku}
                  </TableCell>
                  <TableCell className="py-1.5 text-xs">{item.descricao}</TableCell>
                  <TableCell className="py-1.5 text-xs tabular-nums text-right">
                    {Number(item.quantidade_atual).toLocaleString('pt-BR')}
                  </TableCell>
                  <TableCell className="py-1.5 text-xs tabular-nums text-right">
                    {Number(item.dias_cobertura).toFixed(0)}d
                  </TableCell>
                  <TableCell className="py-1.5 text-xs tabular-nums text-right">
                    {item.sugestao_pedido
                      ? Number(item.sugestao_pedido).toLocaleString('pt-BR')
                      : '-'}
                  </TableCell>
                  <TableCell className="py-1.5">
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
