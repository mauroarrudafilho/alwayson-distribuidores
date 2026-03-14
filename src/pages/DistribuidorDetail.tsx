import { useParams, Link } from 'react-router-dom'
import {
  DollarSign,
  Users,
  Target,
  Award,
  ArrowLeft,
} from 'lucide-react'
import { KPICard } from '@/components/distribuidor/KPICard'
import { KPIGrid } from '@/components/distribuidor/KPIGrid'
import { StatusBadge } from '@/components/distribuidor/StatusBadge'
import { MetaProgressBar } from '@/components/distribuidor/MetaProgressBar'
import { SectionTitle } from '@/components/distribuidor/SectionTitle'
import { useDistribuidor } from '@/hooks/useDistribuidores'
import { useVendedores, usePerformance } from '@/hooks/useDistribuidorPerformance'
import { useClientes } from '@/hooks/useClientesExcelencia'
import { useMetas } from '@/hooks/useMetas'
import { useEstoque } from '@/hooks/useEstoque'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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

export function DistribuidorDetail() {
  const { id } = useParams<{ id: string }>()
  const { data: dist, isLoading } = useDistribuidor(id)
  const { data: vendedores } = useVendedores(id)
  const { data: performance } = usePerformance(id)
  const { data: clientes } = useClientes(id)
  const { data: metas } = useMetas(id)
  const { data: estoque } = useEstoque(id)

  if (isLoading) {
    return (
      <div>
        <Skeleton className="h-5 w-48 mb-4" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-3">
                <Skeleton className="h-3 w-24 mb-2" />
                <Skeleton className="h-5 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (!dist) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-muted-foreground">Distribuidor não encontrado</p>
        <Link to="/distribuidores">
          <Button variant="outline" size="sm" className="mt-4 h-8 text-xs">
            Voltar para lista
          </Button>
        </Link>
      </div>
    )
  }

  const totalFaturamento = (performance ?? []).reduce(
    (sum, p) => sum + Number(p.faturamento),
    0
  )
  const totalPositivados = (performance ?? []).reduce(
    (sum, p) => sum + (p.clientes_positivados ?? 0),
    0
  )
  const totalCarteira = (performance ?? []).reduce(
    (sum, p) => sum + (p.total_clientes_carteira ?? 0),
    0
  )
  const taxaPositivacao =
    totalCarteira > 0 ? (totalPositivados / totalCarteira) * 100 : 0
  const clientesExcelencia = (clientes ?? []).filter((c) => c.plano_excelencia)

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-2 mb-6">
        <Link to="/distribuidores">
          <Button variant="ghost" size="sm" className="h-6 px-2">
            <ArrowLeft className="w-3.5 h-3.5" />
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-semibold text-foreground">{dist.nome}</h1>
          <StatusBadge status={dist.status} />
        </div>
        <span className="text-[11px] text-muted-foreground">
          {dist.cidade} - {dist.estado} | CNPJ: {dist.cnpj}
        </span>
      </div>

      <KPIGrid columns={3}>
        <KPICard
          label="Faturamento"
          value={formatCurrency(totalFaturamento)}
          icon={DollarSign}
          variant="primary"
        />
        <KPICard
          label="Positivação"
          value={`${totalPositivados} / ${totalCarteira}`}
          icon={Users}
          badge={`${taxaPositivacao.toFixed(0)}%`}
        />
        <KPICard
          label="Excelência"
          value={`${clientesExcelencia.length} clientes`}
          icon={Award}
        />
      </KPIGrid>

      <div className="mt-6">
        <Tabs defaultValue="performance">
          <TabsList className="h-8">
            <TabsTrigger value="performance" className="text-sm h-8 px-3">
              Performance
            </TabsTrigger>
            <TabsTrigger value="clientes" className="text-sm h-8 px-3">
              Clientes
            </TabsTrigger>
            <TabsTrigger value="metas" className="text-sm h-8 px-3">
              Metas
            </TabsTrigger>
            <TabsTrigger value="estoque" className="text-sm h-8 px-3">
              Estoque
            </TabsTrigger>
          </TabsList>

          <TabsContent value="performance" className="mt-4">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Vendedor</TableHead>
                      <TableHead className="text-right">Faturamento</TableHead>
                      <TableHead className="text-right">Positivados</TableHead>
                      <TableHead className="text-right">Itens</TableHead>
                      <TableHead className="text-right">Pedidos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!vendedores || vendedores.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-8 text-center text-xs text-muted-foreground">
                          Nenhum vendedor cadastrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      vendedores.map((v) => {
                        const vPerf = (performance ?? []).filter(
                          (p) => p.vendedor_id === v.id
                        )
                        const fat = vPerf.reduce(
                          (s, p) => s + Number(p.faturamento),
                          0
                        )
                        const pos = vPerf.reduce(
                          (s, p) => s + (p.clientes_positivados ?? 0),
                          0
                        )
                        const itens = vPerf.reduce(
                          (s, p) => s + (p.itens_vendidos ?? 0),
                          0
                        )
                        const pedidos = vPerf.reduce(
                          (s, p) => s + (p.pedidos_realizados ?? 0),
                          0
                        )
                        return (
                          <TableRow key={v.id}>
                            <TableCell>
                              <div>
                                <span className="text-xs font-medium">{v.nome}</span>
                                <span className="text-[11px] text-muted-foreground ml-1.5">
                                  {v.tipo}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs tabular-nums text-right">
                              {formatCurrency(fat)}
                            </TableCell>
                            <TableCell className="text-xs tabular-nums text-right">
                              {pos}
                            </TableCell>
                            <TableCell className="text-xs tabular-nums text-right">
                              {itens}
                            </TableCell>
                            <TableCell className="text-xs tabular-nums text-right">
                              {pedidos}
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="clientes" className="mt-4">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Cliente</TableHead>
                      <TableHead>Cidade</TableHead>
                      <TableHead className="text-right">Ticket Médio</TableHead>
                      <TableHead>Excelência</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!clientes || clientes.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-8 text-center text-xs text-muted-foreground">
                          Nenhum cliente cadastrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      clientes.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell>
                            <div>
                              <span className="text-xs font-medium">
                                {c.nome_fantasia ?? c.razao_social}
                              </span>
                              <span className="text-[11px] text-muted-foreground block">
                                {c.cnpj}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {c.cidade} - {c.estado}
                          </TableCell>
                          <TableCell className="text-xs tabular-nums text-right">
                            {c.ticket_medio
                              ? formatCurrency(c.ticket_medio)
                              : '-'}
                          </TableCell>
                          <TableCell>
                            {c.plano_excelencia && (
                              <StatusBadge status="excelencia" />
                            )}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={c.status} />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="metas" className="mt-4">
            <Card>
              <CardContent className="p-3">
                <SectionTitle title="Metas do Período" icon={Target} />
                {!metas || metas.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">
                    Nenhuma meta cadastrada
                  </p>
                ) : (
                  <div className="space-y-3 mt-2">
                    {metas.map((m) => (
                      <MetaProgressBar
                        key={m.id}
                        label={`${m.tipo} (${m.hierarquia})`}
                        percentual={Number(m.percentual_atingimento)}
                        meta={formatCurrency(Number(m.valor_meta))}
                        realizado={formatCurrency(Number(m.valor_realizado))}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="estoque" className="mt-4">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>SKU</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="text-right">Qtd Atual</TableHead>
                      <TableHead className="text-right">Dias Cobertura</TableHead>
                      <TableHead className="text-right">Sugestão</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!estoque || estoque.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-8 text-center text-xs text-muted-foreground">
                          Nenhum item de estoque cadastrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      estoque.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="text-xs font-medium tabular-nums">
                            {item.sku}
                          </TableCell>
                          <TableCell className="text-xs">
                            {item.descricao}
                          </TableCell>
                          <TableCell className="text-xs tabular-nums text-right">
                            {Number(item.quantidade_atual).toLocaleString('pt-BR')}
                          </TableCell>
                          <TableCell className="text-xs tabular-nums text-right">
                            {Number(item.dias_cobertura).toFixed(0)}d
                          </TableCell>
                          <TableCell className="text-xs tabular-nums text-right">
                            {item.sugestao_pedido
                              ? Number(item.sugestao_pedido).toLocaleString('pt-BR')
                              : '-'}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={item.status} />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
