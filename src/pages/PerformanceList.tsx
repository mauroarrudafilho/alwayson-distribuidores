import { useState } from 'react'
import { Link } from 'react-router-dom'
import { DollarSign, Users, ShoppingCart, Package } from 'lucide-react'
import { PageHeader } from '@/components/distribuidor/PageHeader'
import { KPICard } from '@/components/distribuidor/KPICard'
import { KPIGrid } from '@/components/distribuidor/KPIGrid'
import { useDistribuidores } from '@/hooks/useDistribuidores'
import { useAllPerformance } from '@/hooks/useDistribuidorPerformance'
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

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export function PerformanceList() {
  const [distribuidorFilter, setDistribuidorFilter] = useState<string>('todos')
  const { data: distribuidores } = useDistribuidores()
  const { data: allPerformance, isLoading } = useAllPerformance()

  const performance = (allPerformance ?? []).filter(
    (p) =>
      distribuidorFilter === 'todos' ||
      p.distribuidor_id === distribuidorFilter
  )

  const totalFaturamento = performance.reduce(
    (sum, p) => sum + Number(p.faturamento),
    0
  )
  const totalPositivados = performance.reduce(
    (sum, p) => sum + (p.clientes_positivados ?? 0),
    0
  )
  const totalCarteira = performance.reduce(
    (sum, p) => sum + (p.total_clientes_carteira ?? 0),
    0
  )
  const totalPedidos = performance.reduce(
    (sum, p) => sum + (p.pedidos_realizados ?? 0),
    0
  )
  const totalItens = performance.reduce(
    (sum, p) => sum + (p.itens_vendidos ?? 0),
    0
  )

  // Aggregate by vendedor
  const vendedorMap = new Map<
    string,
    {
      vendedor_id: string
      distribuidor_id: string
      faturamento: number
      positivados: number
      carteira: number
      itens: number
      pedidos: number
    }
  >()

  for (const p of performance) {
    const existing = vendedorMap.get(p.vendedor_id)
    if (existing) {
      existing.faturamento += Number(p.faturamento)
      existing.positivados += p.clientes_positivados ?? 0
      existing.carteira += p.total_clientes_carteira ?? 0
      existing.itens += p.itens_vendidos ?? 0
      existing.pedidos += p.pedidos_realizados ?? 0
    } else {
      vendedorMap.set(p.vendedor_id, {
        vendedor_id: p.vendedor_id,
        distribuidor_id: p.distribuidor_id,
        faturamento: Number(p.faturamento),
        positivados: p.clientes_positivados ?? 0,
        carteira: p.total_clientes_carteira ?? 0,
        itens: p.itens_vendidos ?? 0,
        pedidos: p.pedidos_realizados ?? 0,
      })
    }
  }

  const ranking = [...vendedorMap.values()].sort(
    (a, b) => b.faturamento - a.faturamento
  )

  return (
    <div>
      <PageHeader
        title="Performance"
        description="Ranking e comparativo de vendedores por sell-out"
      />

      <Card className="rounded-md border border-border/50 shadow-none mb-4">
        <CardContent className="p-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                Distribuidor
              </label>
              <Select
                value={distribuidorFilter}
                onValueChange={(v) => setDistribuidorFilter(v ?? 'todos')}
              >
                <SelectTrigger className="h-8 text-xs shadow-none border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os distribuidores</SelectItem>
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
        <KPICard
          label="Faturamento Total"
          value={formatCurrency(totalFaturamento)}
          icon={DollarSign}
          variant="primary"
        />
        <KPICard
          label="Clientes Positivados"
          value={`${totalPositivados} / ${totalCarteira}`}
          icon={Users}
          badge={
            totalCarteira > 0
              ? `${((totalPositivados / totalCarteira) * 100).toFixed(0)}%`
              : '0%'
          }
        />
        <KPICard
          label="Itens Vendidos"
          value={totalItens.toLocaleString('pt-BR')}
          icon={Package}
        />
        <KPICard
          label="Pedidos Realizados"
          value={totalPedidos.toLocaleString('pt-BR')}
          icon={ShoppingCart}
        />
      </KPIGrid>

      <Card className="rounded-md border border-border/50 shadow-none mt-4">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border/50">
              <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground py-2 h-8 w-8">
                #
              </TableHead>
              <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground py-2 h-8">
                Vendedor
              </TableHead>
              <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground py-2 h-8">
                Distribuidor
              </TableHead>
              <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground py-2 h-8 text-right">
                Faturamento
              </TableHead>
              <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground py-2 h-8 text-right">
                Positivados
              </TableHead>
              <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground py-2 h-8 text-right">
                Itens
              </TableHead>
              <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground py-2 h-8 text-right">
                Pedidos
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} className="border-border/30">
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j} className="py-1.5">
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : ranking.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-8 text-center text-xs text-muted-foreground"
                >
                  Nenhum dado de performance encontrado
                </TableCell>
              </TableRow>
            ) : (
              ranking.map((r, idx) => {
                const dist = (distribuidores ?? []).find(
                  (d) => d.id === r.distribuidor_id
                )
                return (
                  <TableRow
                    key={r.vendedor_id}
                    className="hover:bg-muted/30 border-border/30"
                  >
                    <TableCell className="py-1.5 text-[10px] font-bold text-muted-foreground">
                      {idx + 1}
                    </TableCell>
                    <TableCell className="py-1.5 text-xs font-medium">
                      {r.vendedor_id.slice(0, 8)}...
                    </TableCell>
                    <TableCell className="py-1.5">
                      {dist ? (
                        <Link
                          to={`/distribuidores/${dist.id}`}
                          className="text-xs text-muted-foreground hover:text-primary transition-colors"
                        >
                          {dist.nome}
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="py-1.5 text-xs font-medium tabular-nums text-right">
                      {formatCurrency(r.faturamento)}
                    </TableCell>
                    <TableCell className="py-1.5 text-xs tabular-nums text-right">
                      {r.positivados} / {r.carteira}
                    </TableCell>
                    <TableCell className="py-1.5 text-xs tabular-nums text-right">
                      {r.itens.toLocaleString('pt-BR')}
                    </TableCell>
                    <TableCell className="py-1.5 text-xs tabular-nums text-right">
                      {r.pedidos}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
