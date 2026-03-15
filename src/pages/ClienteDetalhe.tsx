import { useState, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  DollarSign,
  Receipt,
  CalendarClock,
  Repeat,
  ChevronDown,
  ChevronRight,
  Package,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { ClienteDistribuidor } from '@/types/distribuidor'
import type { Faturamento, FaturamentoItem } from '@/types/faturamento'
import { useFaturamento } from '@/hooks/useFaturamento'
import { useClienteFaturamentoMensal } from '@/hooks/useFaturamento'
import { formatCurrency, formatDate } from '@/lib/format'
import { KPICard } from '@/components/distribuidor/KPICard'
import { KPIGrid } from '@/components/distribuidor/KPIGrid'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

function useCliente(id: string | undefined) {
  return useQuery({
    queryKey: ['cliente-detalhe', id],
    queryFn: async () => {
      if (!id) throw new Error('id required')
      const { data, error } = await supabase
        .from('alwayson_clientes_distribuidor')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      return data as ClienteDistribuidor
    },
    enabled: !!id,
  })
}

function useAllFaturamentoItens(faturamentoIds: string[]) {
  return useQuery({
    queryKey: ['all-faturamento-itens', faturamentoIds],
    queryFn: async () => {
      if (faturamentoIds.length === 0) return []
      const { data, error } = await supabase
        .from('alwayson_faturamento_itens')
        .select('*')
        .in('faturamento_id', faturamentoIds)
      if (error) throw error
      return data as FaturamentoItem[]
    },
    enabled: faturamentoIds.length > 0,
  })
}

function useVendedorNome(vendedorId: string | undefined) {
  return useQuery({
    queryKey: ['vendedor-nome', vendedorId],
    queryFn: async () => {
      if (!vendedorId) throw new Error('vendedorId required')
      const { data, error } = await supabase
        .from('alwayson_vendedores_distribuidor')
        .select('nome')
        .eq('id', vendedorId)
        .single()
      if (error) throw error
      return data.nome as string
    },
    enabled: !!vendedorId,
  })
}

function ExpandableRow({ fat, itens }: { fat: Faturamento; itens: FaturamentoItem[] }) {
  const [open, setOpen] = useState(false)
  const rowItens = itens.filter((i) => i.faturamento_id === fat.id)

  return (
    <>
      <TableRow
        className="cursor-pointer"
        onClick={() => setOpen(!open)}
      >
        <TableCell>
          <span className="flex items-center gap-1.5">
            {open ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            {formatDate(fat.data_emissao)}
          </span>
        </TableCell>
        <TableCell className="font-mono text-xs">{fat.numero_nf}</TableCell>
        <TableCell className="text-right font-medium tabular-nums">
          {formatCurrency(fat.valor_total)}
        </TableCell>
      </TableRow>
      {open && rowItens.length > 0 && (
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableCell colSpan={3} className="p-0">
            <div className="px-8 py-2">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/30">
                    <TableHead>SKU</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">Vlr Unit.</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rowItens.map((item) => (
                    <TableRow key={item.id} className="border-border/30">
                      <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                      <TableCell>{item.descricao}</TableCell>
                      <TableCell className="text-right tabular-nums">{item.quantidade}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(item.valor_unitario)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatCurrency(item.valor_total)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TableCell>
        </TableRow>
      )}
      {open && rowItens.length === 0 && (
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-4">
            Nenhum item encontrado para esta NF
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

function MonthlyBarChart({ data }: { data: { month: string; total: number }[] }) {
  const maxValue = Math.max(...data.map((d) => d.total), 1)

  function formatMonth(m: string) {
    const [year, month] = m.split('-')
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    return `${months[Number(month) - 1]}/${year.slice(2)}`
  }

  return (
    <div className="space-y-2">
      {data.map((d) => {
        const pct = (d.total / maxValue) * 100
        return (
          <div key={d.month} className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-16 shrink-0 text-right tabular-nums">
              {formatMonth(d.month)}
            </span>
            <div className="flex-1 h-6 bg-muted/50 rounded overflow-hidden">
              <div
                className="h-full bg-primary/80 rounded transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs font-medium tabular-nums w-24 text-right">
              {formatCurrency(d.total)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export function ClienteDetalhe() {
  const { id } = useParams<{ id: string }>()
  const { data: cliente, isLoading: loadingCliente } = useCliente(id)
  const { data: faturamentos, isLoading: loadingFat } = useFaturamento(id)
  const { data: mensal, isLoading: loadingMensal } = useClienteFaturamentoMensal(id)
  const { data: vendedorNome } = useVendedorNome(cliente?.vendedor_id)

  const faturamentoIds = useMemo(
    () => faturamentos?.map((f) => f.id) ?? [],
    [faturamentos]
  )
  const { data: allItens } = useAllFaturamentoItens(faturamentoIds)

  const kpis = useMemo(() => {
    if (!faturamentos) return null
    const total = faturamentos.reduce((sum, f) => sum + f.valor_total, 0)
    const count = faturamentos.length
    const ticketMedio = count > 0 ? total / count : 0

    let freqCompra = 0
    if (count > 1) {
      const dates = faturamentos.map((f) => new Date(f.data_emissao).getTime()).sort((a, b) => a - b)
      const spanMs = dates[dates.length - 1] - dates[0]
      const spanMonths = spanMs / (1000 * 60 * 60 * 24 * 30)
      freqCompra = spanMonths > 0 ? count / spanMonths : count
    } else {
      freqCompra = count
    }

    return { total, ticketMedio, freqCompra }
  }, [faturamentos])

  const produtosMaisComprados = useMemo(() => {
    if (!allItens || !faturamentos) return []

    const fatMap = new Map(faturamentos.map((f) => [f.id, f]))
    const skuMap = new Map<string, {
      descricao: string
      qtdTotal: number
      frequencia: Set<string>
      ultimaCompra: string
    }>()

    for (const item of allItens) {
      const fat = fatMap.get(item.faturamento_id)
      const existing = skuMap.get(item.sku)
      if (existing) {
        existing.qtdTotal += item.quantidade
        existing.frequencia.add(item.faturamento_id)
        if (fat && fat.data_emissao > existing.ultimaCompra) {
          existing.ultimaCompra = fat.data_emissao
        }
      } else {
        skuMap.set(item.sku, {
          descricao: item.descricao,
          qtdTotal: item.quantidade,
          frequencia: new Set([item.faturamento_id]),
          ultimaCompra: fat?.data_emissao ?? '',
        })
      }
    }

    return Array.from(skuMap.entries())
      .map(([sku, v]) => ({
        sku,
        descricao: v.descricao,
        qtdTotal: v.qtdTotal,
        frequencia: v.frequencia.size,
        ultimaCompra: v.ultimaCompra,
      }))
      .sort((a, b) => b.qtdTotal - a.qtdTotal)
  }, [allItens, faturamentos])

  if (loadingCliente) {
    return (
      <div className="animate-fade-in space-y-6">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    )
  }

  if (!cliente) {
    return (
      <div className="animate-fade-in">
        <Link
          to="/clientes"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>
        <p className="text-sm text-muted-foreground">Cliente não encontrado.</p>
      </div>
    )
  }

  return (
    <div className="animate-fade-in space-y-6">
      <Link
        to="/clientes"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </Link>

      <div>
        <h1 className="text-lg font-semibold text-foreground">
          {cliente.nome_fantasia || cliente.razao_social}
        </h1>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
          <span className="font-mono text-xs">{cliente.cnpj}</span>
          <span>{cliente.cidade}-{cliente.estado}</span>
          {vendedorNome && <span>Vendedor: {vendedorNome}</span>}
        </div>
      </div>

      <KPIGrid columns={4}>
        <KPICard
          label="Faturamento Total"
          value={kpis ? formatCurrency(kpis.total) : '—'}
          icon={DollarSign}
          variant="primary"
        />
        <KPICard
          label="Ticket Médio"
          value={kpis ? formatCurrency(kpis.ticketMedio) : '—'}
          icon={Receipt}
        />
        <KPICard
          label="Freq. de Compra"
          value={kpis ? `${kpis.freqCompra.toFixed(1)}/mês` : '—'}
          icon={Repeat}
        />
        <KPICard
          label="Última Compra"
          value={cliente.ultima_compra ? formatDate(cliente.ultima_compra) : '—'}
          icon={CalendarClock}
        />
      </KPIGrid>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Evolução de Faturamento</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {loadingMensal ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-full" />
              ))}
            </div>
          ) : mensal && mensal.length > 0 ? (
            <MonthlyBarChart data={mensal} />
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              Sem dados de faturamento
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Histórico de Faturamento</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loadingFat ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : faturamentos && faturamentos.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Nº NF</TableHead>
                  <TableHead className="text-right">Valor Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {faturamentos.map((fat) => (
                  <ExpandableRow
                    key={fat.id}
                    fat={fat}
                    itens={allItens ?? []}
                  />
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum faturamento encontrado
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Produtos Mais Comprados
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!allItens || allItens.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Sem dados de produtos
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Qtd Total</TableHead>
                  <TableHead className="text-right">Frequência</TableHead>
                  <TableHead className="text-right">Última Compra</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {produtosMaisComprados.map((p) => (
                  <TableRow key={p.sku}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{p.descricao}</div>
                        <div className="text-xs text-muted-foreground font-mono">{p.sku}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{p.qtdTotal}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {p.frequencia} {p.frequencia === 1 ? 'NF' : 'NFs'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {p.ultimaCompra ? formatDate(p.ultimaCompra) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
