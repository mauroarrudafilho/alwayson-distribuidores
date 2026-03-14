import { useState } from 'react'
import { Link } from 'react-router-dom'
import { DollarSign, Users, ShoppingCart, Package } from 'lucide-react'
import { PageHeader } from '@/components/distribuidor/PageHeader'
import { KPICard } from '@/components/distribuidor/KPICard'
import { KPIGrid } from '@/components/distribuidor/KPIGrid'
import { FilterBar, FilterField } from '@/components/distribuidor/FilterBar'
import { useDistribuidores } from '@/hooks/useDistribuidores'
import { useAllPerformance } from '@/hooks/useDistribuidorPerformance'
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
import { formatCurrency } from '@/lib/format'

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
    <div className="animate-fade-in">
      <PageHeader
        title="Performance"
        description="Ranking e comparativo de vendedores por sell-out"
      />

      <FilterBar>
        <FilterField label="Distribuidor">
          <Select
            value={distribuidorFilter}
            onValueChange={(v) => setDistribuidorFilter(v ?? 'todos')}
          >
            <SelectTrigger className="h-8 text-sm">
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
        </FilterField>
      </FilterBar>

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

      <Card className="mt-6">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-8">#</TableHead>
              <TableHead>Vendedor</TableHead>
              <TableHead>Distribuidor</TableHead>
              <TableHead className="text-right">Faturamento</TableHead>
              <TableHead className="text-right">Positivados</TableHead>
              <TableHead className="text-right">Itens</TableHead>
              <TableHead className="text-right">Pedidos</TableHead>
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
                  <TableRow key={r.vendedor_id}>
                    <TableCell className="text-[11px] font-bold text-muted-foreground">
                      {idx + 1}
                    </TableCell>
                    <TableCell className="text-xs font-medium">
                      {r.vendedor_id.slice(0, 8)}...
                    </TableCell>
                    <TableCell>
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
                    <TableCell className="text-xs font-medium tabular-nums text-right">
                      {formatCurrency(r.faturamento)}
                    </TableCell>
                    <TableCell className="text-xs tabular-nums text-right">
                      {r.positivados} / {r.carteira}
                    </TableCell>
                    <TableCell className="text-xs tabular-nums text-right">
                      {r.itens.toLocaleString('pt-BR')}
                    </TableCell>
                    <TableCell className="text-xs tabular-nums text-right">
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
