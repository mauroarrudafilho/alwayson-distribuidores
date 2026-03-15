import { useMemo } from 'react'
import { DollarSign, Users, ShoppingCart, Target } from 'lucide-react'
import { KPICard } from '@/components/distribuidor/KPICard'
import { KPIGrid } from '@/components/distribuidor/KPIGrid'
import { MetaProgressBar } from '@/components/distribuidor/MetaProgressBar'
import { useDistribuidores } from '@/hooks/useDistribuidores'
import { useAllPerformance } from '@/hooks/useDistribuidorPerformance'
import { useMetas } from '@/hooks/useMetas'
import { Card } from '@/components/ui/card'
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
import { usePerformanceContext } from './PerformanceContext'
import type { PerfTab } from './usePerfFilters'

export function DistribuidorTab() {
  const { drillDown, availableTabs } = usePerformanceContext()
  const { data: distribuidores, isLoading: loadingDist } = useDistribuidores()
  const { data: allPerformance, isLoading: loadingPerf } = useAllPerformance()
  const { data: metas } = useMetas()

  const isLoading = loadingDist || loadingPerf

  const rows = useMemo(() => {
    if (!distribuidores || !allPerformance) return []
    return distribuidores.map((dist) => {
      const perfRecords = allPerformance.filter(
        (p) => p.distribuidor_id === dist.id
      )
      const faturamento = perfRecords.reduce(
        (sum, p) => sum + Number(p.faturamento),
        0
      )
      const positivados = perfRecords.reduce(
        (sum, p) => sum + (p.clientes_positivados ?? 0),
        0
      )
      const itens = perfRecords.reduce(
        (sum, p) => sum + (p.itens_vendidos ?? 0),
        0
      )
      const pedidos = perfRecords.reduce(
        (sum, p) => sum + (p.pedidos_realizados ?? 0),
        0
      )
      return { ...dist, faturamento, positivados, itens, pedidos }
    })
  }, [distribuidores, allPerformance])

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => ({
        faturamento: acc.faturamento + r.faturamento,
        positivados: acc.positivados + r.positivados,
        itens: acc.itens + r.itens,
        pedidos: acc.pedidos + r.pedidos,
      }),
      { faturamento: 0, positivados: 0, itens: 0, pedidos: 0 }
    )
  }, [rows])

  const metaFaturamento = useMemo(() => {
    const m = (metas ?? []).find(
      (meta) => meta.hierarquia === 'distribuidor' && meta.tipo === 'faturamento'
    )
    if (!m) return null
    return {
      meta: Number(m.valor_meta),
      realizado: Number(m.valor_realizado),
      percentual: Number(m.percentual_atingimento),
    }
  }, [metas])

  const nextTab = useMemo<PerfTab>(() => {
    const afterDist = availableTabs.find(
      (t) => t !== 'distribuidor' && t !== 'cliente'
    )
    return afterDist ?? 'vendas'
  }, [availableTabs])

  const handleRowClick = (distribuidorId: string) => {
    drillDown(nextTab, { distribuidorId })
  }

  return (
    <div className="space-y-6 mt-4">
      <KPIGrid columns={4}>
        <KPICard
          label="Faturamento Total"
          value={formatCurrency(totals.faturamento)}
          icon={DollarSign}
          variant="primary"
        />
        <KPICard
          label="Clientes Positivados"
          value={totals.positivados.toLocaleString('pt-BR')}
          icon={Users}
        />
        <KPICard
          label="Itens Vendidos"
          value={totals.itens.toLocaleString('pt-BR')}
          icon={ShoppingCart}
        />
        <KPICard
          label="Meta vs Realizado"
          value={
            metaFaturamento
              ? `${metaFaturamento.percentual.toFixed(1)}%`
              : '—'
          }
          icon={Target}
        />
      </KPIGrid>

      {metaFaturamento && (
        <MetaProgressBar
          label="Faturamento"
          percentual={metaFaturamento.percentual}
          meta={formatCurrency(metaFaturamento.meta)}
          realizado={formatCurrency(metaFaturamento.realizado)}
        />
      )}

      <Card>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Distribuidor</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Faturamento</TableHead>
              <TableHead className="text-right hidden sm:table-cell">Positivados</TableHead>
              <TableHead className="text-right hidden md:table-cell">Itens</TableHead>
              <TableHead className="text-right hidden md:table-cell">Pedidos</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 3 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center">
                  <p className="text-xs text-muted-foreground">
                    Nenhum distribuidor encontrado
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => handleRowClick(row.id)}
                >
                  <TableCell className="text-xs font-medium max-w-[150px] sm:max-w-none truncate">
                    {row.nome}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {row.estado}
                  </TableCell>
                  <TableCell className="text-xs tabular-nums text-right">
                    {formatCurrency(row.faturamento)}
                  </TableCell>
                  <TableCell className="text-xs tabular-nums text-right hidden sm:table-cell">
                    {row.positivados.toLocaleString('pt-BR')}
                  </TableCell>
                  <TableCell className="text-xs tabular-nums text-right hidden md:table-cell">
                    {row.itens.toLocaleString('pt-BR')}
                  </TableCell>
                  <TableCell className="text-xs tabular-nums text-right hidden md:table-cell">
                    {row.pedidos.toLocaleString('pt-BR')}
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
