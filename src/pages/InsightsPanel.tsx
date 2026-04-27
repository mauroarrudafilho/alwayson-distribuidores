import { useState, useMemo } from 'react'
import {
  BarChart3,
  DollarSign,
  MapPin,
  Users,
  Receipt,
  Package,
  ChevronRight,
  ChevronDown,
  ArrowLeft,
  TrendingUp,
  ShoppingCart,
} from 'lucide-react'
import { PageHeader } from '@/components/distribuidor/PageHeader'
import { KPICard } from '@/components/distribuidor/KPICard'
import { KPIGrid } from '@/components/distribuidor/KPIGrid'
import { SectionTitle } from '@/components/distribuidor/SectionTitle'
import { FilterBar, FilterField } from '@/components/distribuidor/FilterBar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatCurrency } from '@/lib/format'
import {
  MOCK_CIDADES,
  MOCK_TOP_CLIENTES,
  MOCK_CLIENTE_HISTORICO,
  MOCK_CLIENTE_MIX,
  MOCK_PERIODO,
  MOCK_KPI_GERAL,
  MOCK_TODOS_CLIENTES,
} from '@/hooks/useMockInsights'
import type { InsightsTopCliente } from '@/types/insights'
import { cn } from '@/lib/utils'

// ─── Subcomponentes ──────────────────────────────────────────────────────────

function BarRow({ label, value, max, suffix = '' }: { label: string; value: number; max: number; suffix?: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground w-32 shrink-0 truncate">{label}</span>
      <div className="flex-1 h-5 bg-muted/50 rounded overflow-hidden">
        <div className="h-full bg-primary/75 rounded transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-medium tabular-nums w-24 text-right">
        {suffix ? `${value.toLocaleString('pt-BR')} ${suffix}` : formatCurrency(value)}
      </span>
    </div>
  )
}

function MixRow({ row, maxFat }: { row: import('@/types/insights').InsightsClienteMixRow; maxFat: number }) {
  const pct = maxFat > 0 ? (row.faturamento_total / maxFat) * 100 : 0
  return (
    <TableRow>
      <TableCell className="font-mono text-xs">{row.sku}</TableCell>
      <TableCell className="max-w-[180px] truncate">{row.descricao}</TableCell>
      <TableCell className="text-right tabular-nums">
        {row.quantidade_total.toLocaleString('pt-BR')}
        <span className="ml-1 text-muted-foreground text-xs">{row.unidade}</span>
      </TableCell>
      <TableCell className="text-right text-xs text-muted-foreground tabular-nums">{row.meses_ativos}m</TableCell>
      <TableCell className="w-40">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-3 bg-muted/50 rounded overflow-hidden">
            <div className="h-full bg-primary/70 rounded" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs tabular-nums w-20 text-right font-medium">{formatCurrency(row.faturamento_total)}</span>
        </div>
      </TableCell>
    </TableRow>
  )
}

function ClienteDetalheDrawer({
  cliente,
  onClose,
}: {
  cliente: InsightsTopCliente
  onClose: () => void
}) {
  const historico = MOCK_CLIENTE_HISTORICO[cliente.cnpj_cliente] ?? []
  const mix = MOCK_CLIENTE_MIX[cliente.cnpj_cliente] ?? []
  const maxFat = Math.max(...(mix.map((m) => m.faturamento_total)), 1)
  const maxBar = Math.max(...(historico.map((h) => h.faturamento)), 1)

  function formatMes(m: string) {
    const [year, month] = m.split('-')
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    return `${months[Number(month) - 1]}/${year.slice(2)}`
  }

  const totalFaturamento = historico.reduce((s, h) => s + h.faturamento, 0)
  const totalNfs = historico.reduce((s, h) => s + h.total_nfs, 0)
  const maxSkus = Math.max(...historico.map((h) => h.total_skus))

  return (
    <div className="animate-fade-in">
      <button
        onClick={onClose}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar ao Insights
      </button>

      <div className="mb-4">
        <h2 className="text-base font-semibold">{cliente.nome_cliente}</h2>
        <p className="text-xs text-muted-foreground font-mono mt-0.5">
          {cliente.cnpj_cliente} · {cliente.cidade}/{cliente.estado}
        </p>
      </div>

      <KPIGrid columns={4}>
        <KPICard label="Faturamento Total"  value={formatCurrency(totalFaturamento)} icon={DollarSign} />
        <KPICard label="NFs Emitidas"       value={totalNfs}                         icon={Receipt} />
        <KPICard label="SKUs no Mix"         value={mix.length}                       icon={Package} badge={`${maxSkus} máx/mês`} />
        <KPICard label="Última Compra"       value={new Date(cliente.ultima_compra + 'T12:00:00').toLocaleDateString('pt-BR')} icon={ShoppingCart} />
      </KPIGrid>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Evolução mensal */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
              Evolução Mensal de Faturamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            {historico.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem histórico disponível.</p>
            ) : (
              <div className="space-y-2">
                {historico.map((h) => (
                  <BarRow key={h.ano_mes} label={formatMes(h.ano_mes)} value={h.faturamento} max={maxBar} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Mix por mês resumo */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-muted-foreground" />
              SKUs por Mês
            </CardTitle>
          </CardHeader>
          <CardContent>
            {historico.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados.</p>
            ) : (
              <div className="space-y-2">
                {historico.map((h) => (
                  <BarRow
                    key={h.ano_mes}
                    label={formatMes(h.ano_mes)}
                    value={h.total_skus}
                    max={maxSkus}
                    suffix="SKUs"
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Mix cadastrado */}
      <Card className="mt-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Package className="w-4 h-4 text-muted-foreground" />
            Mix Cadastrado
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {mix.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Sem itens.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Qtd Total</TableHead>
                  <TableHead className="text-right">Meses</TableHead>
                  <TableHead>Faturamento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mix.map((row) => (
                  <MixRow key={row.sku} row={row} maxFat={maxFat} />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Visão por cidade ────────────────────────────────────────────────────────

function CidadeRow({
  row,
  maxFat,
  onSelectCliente,
}: {
  row: (typeof MOCK_CIDADES)[number]
  maxFat: number
  onSelectCliente: (c: InsightsTopCliente) => void
}) {
  const [open, setOpen] = useState(false)
  const topClientes = MOCK_TOP_CLIENTES[row.cidade] ?? []

  return (
    <>
      <TableRow
        className="cursor-pointer"
        onClick={() => setOpen(!open)}
      >
        <TableCell>
          <span className="flex items-center gap-1.5">
            {open ? (
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            )}
            <span className="font-medium">{row.cidade}</span>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">{row.estado}</Badge>
          </span>
        </TableCell>
        <TableCell className="text-right tabular-nums font-medium">{formatCurrency(row.faturamento_total)}</TableCell>
        <TableCell className="hidden sm:table-cell text-right tabular-nums">{row.total_nfs}</TableCell>
        <TableCell className="hidden md:table-cell text-right tabular-nums">{row.total_clientes}</TableCell>
        <TableCell className="hidden lg:table-cell text-right tabular-nums">{row.total_skus}</TableCell>
        <TableCell className="hidden lg:table-cell">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-3 bg-muted/50 rounded overflow-hidden">
              <div
                className="h-full bg-primary/70 rounded"
                style={{ width: `${(row.faturamento_total / maxFat) * 100}%` }}
              />
            </div>
          </div>
        </TableCell>
      </TableRow>

      {open && (
        <TableRow className="bg-muted/20 hover:bg-muted/20">
          <TableCell colSpan={6} className="p-0">
            <div className="px-8 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Top Clientes — {row.cidade}
              </p>
              <Table>
                <TableHeader>
                  <TableRow className="border-border/30">
                    <TableHead>Cliente</TableHead>
                    <TableHead className="hidden sm:table-cell font-mono text-xs">CNPJ</TableHead>
                    <TableHead className="text-right">Faturamento</TableHead>
                    <TableHead className="hidden md:table-cell text-right">NFs</TableHead>
                    <TableHead className="hidden md:table-cell text-right">SKUs</TableHead>
                    <TableHead className="hidden lg:table-cell text-right">Última Compra</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topClientes.map((c) => (
                    <TableRow
                      key={c.cnpj_cliente}
                      className="cursor-pointer border-border/30"
                      onClick={(e) => {
                        e.stopPropagation()
                        onSelectCliente(c)
                      }}
                    >
                      <TableCell className="font-medium">{c.nome_cliente}</TableCell>
                      <TableCell className="hidden sm:table-cell font-mono text-xs text-muted-foreground">
                        {c.cnpj_cliente}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatCurrency(c.faturamento_total)}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-right tabular-nums">{c.total_nfs}</TableCell>
                      <TableCell className="hidden md:table-cell text-right tabular-nums">{c.total_skus}</TableCell>
                      <TableCell className="hidden lg:table-cell text-right text-xs text-muted-foreground">
                        {new Date(c.ultima_compra + 'T12:00:00').toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ))}
                  {topClientes.length === 0 && (
                    <TableRow className="border-border/30">
                      <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-3">
                        Sem dados de clientes para esta cidade
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

// ─── Página principal ────────────────────────────────────────────────────────

export function InsightsPanel() {
  const [busca, setBusca] = useState('')
  const [estadoFilter, setEstadoFilter] = useState('')
  const [clienteDetalhe, setClienteDetalhe] = useState<InsightsTopCliente | null>(null)
  const [insightsTab, setInsightsTab] = useState<'territorio' | 'clientes'>('territorio')
  const [tabBeforeDetail, setTabBeforeDetail] = useState<'territorio' | 'clientes'>('territorio')
  const [buscaCliente, setBuscaCliente] = useState('')
  const [estadoCliente, setEstadoCliente] = useState('')

  const openClienteDetalhe = (c: InsightsTopCliente) => {
    setTabBeforeDetail(insightsTab)
    setClienteDetalhe(c)
  }

  const cidadesFiltradas = useMemo(() => {
    return MOCK_CIDADES.filter((c) => {
      const matchBusca = busca === '' ||
        c.cidade.toLowerCase().includes(busca.toLowerCase()) ||
        c.estado.toLowerCase().includes(busca.toLowerCase())
      const matchEstado = estadoFilter === '' || c.estado === estadoFilter
      return matchBusca && matchEstado
    })
  }, [busca, estadoFilter])

  const maxFat = Math.max(...MOCK_CIDADES.map((c) => c.faturamento_total), 1)

  const estados = useMemo(
    () => [...new Set(MOCK_CIDADES.map((c) => c.estado))].sort(),
    []
  )

  const faturamentoFiltrado = cidadesFiltradas.reduce((s, c) => s + c.faturamento_total, 0)
  const clientesFiltrados  = cidadesFiltradas.reduce((s, c) => s + c.total_clientes, 0)
  const nfsFiltradas        = cidadesFiltradas.reduce((s, c) => s + c.total_nfs, 0)

  const clientesListaFiltrada = useMemo(() => {
    const raw = buscaCliente.trim()
    const q = raw.replace(/\D/g, '')
    const nameQ = raw.toLowerCase()
    return MOCK_TODOS_CLIENTES.filter((c) => {
      const matchUf = estadoCliente === '' || c.estado === estadoCliente
      if (raw === '') return matchUf
      const cnpjDigits = c.cnpj_cliente.replace(/\D/g, '')
      const matchCnpj = q.length >= 2 && cnpjDigits.includes(q)
      const matchNome = c.nome_cliente?.toLowerCase().includes(nameQ) ?? false
      const matchCidade = c.cidade?.toLowerCase().includes(nameQ) ?? false
      const matchUfText = c.estado?.toLowerCase() === nameQ
      return matchUf && (matchCnpj || matchNome || matchCidade || matchUfText)
    })
  }, [buscaCliente, estadoCliente])

  // ─── Detalhe de cliente ───────────────────────────────────────────────────
  if (clienteDetalhe) {
    return (
      <div className="animate-fade-in">
        <PageHeader
          title="Insights"
          description={`Base histórica ${MOCK_PERIODO.inicio} – ${MOCK_PERIODO.fim}`}
        />
        <ClienteDetalheDrawer
          cliente={clienteDetalhe}
          onClose={() => {
            setClienteDetalhe(null)
            setInsightsTab(tabBeforeDetail)
          }}
        />
      </div>
    )
  }

  // ─── Visão principal (abas) ───────────────────────────────────────────────
  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Insights"
        description={`Base histórica ${MOCK_PERIODO.inicio} – ${MOCK_PERIODO.fim} · ${MOCK_KPI_GERAL.total_cidades} cidades`}
      />

      <Tabs value={insightsTab} onValueChange={(v) => setInsightsTab(v as 'territorio' | 'clientes')}>
        <TabsList
          variant="line"
          className="mb-5 w-fit max-w-full h-auto gap-8 border-0 border-b border-border/40 bg-transparent p-0"
        >
          <TabsTrigger
            value="territorio"
            className="px-0 py-2 text-sm font-medium text-muted-foreground data-active:text-foreground data-active:font-semibold"
          >
            Território
          </TabsTrigger>
          <TabsTrigger
            value="clientes"
            className="px-0 py-2 text-sm font-medium text-muted-foreground data-active:text-foreground data-active:font-semibold"
          >
            Clientes
          </TabsTrigger>
        </TabsList>

        <KPIGrid columns={5} className="mb-6">
          <KPICard
            label="Faturamento Total"
            value={formatCurrency(MOCK_KPI_GERAL.faturamento_total)}
            icon={DollarSign}
            variant="primary"
          />
          <KPICard label="Cidades"         value={MOCK_KPI_GERAL.total_cidades}   icon={MapPin} />
          <KPICard label="Clientes Únicos" value={MOCK_KPI_GERAL.total_clientes}  icon={Users} />
          <KPICard label="NFs Emitidas"    value={MOCK_KPI_GERAL.total_nfs.toLocaleString('pt-BR')} icon={Receipt} />
          <KPICard label="SKUs Ativos"     value={MOCK_KPI_GERAL.total_skus}      icon={Package} />
        </KPIGrid>

        <TabsContent value="territorio" className="mt-0">
          <FilterBar columns={2}>
            <FilterField label="Buscar cidade / estado">
              <Input
                placeholder="João Pessoa, PB…"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="h-8 text-sm"
              />
            </FilterField>
            <FilterField label="Estado">
              <div className="flex gap-1.5 flex-wrap">
                <Button
                  size="sm"
                  variant={estadoFilter === '' ? 'default' : 'outline'}
                  className="h-8 text-xs"
                  onClick={() => setEstadoFilter('')}
                >
                  Todos
                </Button>
                {estados.map((uf) => (
                  <Button
                    key={uf}
                    size="sm"
                    variant={estadoFilter === uf ? 'default' : 'outline'}
                    className="h-8 text-xs"
                    onClick={() => setEstadoFilter(uf)}
                  >
                    {uf}
                  </Button>
                ))}
              </div>
            </FilterField>
          </FilterBar>

          {(busca !== '' || estadoFilter !== '') && (
            <KPIGrid columns={3} className="mb-6">
              <KPICard label="Faturamento (filtro)" value={formatCurrency(faturamentoFiltrado)} icon={DollarSign} />
              <KPICard label="Clientes (filtro)"    value={clientesFiltrados}                   icon={Users} />
              <KPICard label="NFs (filtro)"          value={nfsFiltradas}                        icon={Receipt} />
            </KPIGrid>
          )}

          <SectionTitle title="Cidades" icon={MapPin} />
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cidade</TableHead>
                    <TableHead className="text-right">Faturamento</TableHead>
                    <TableHead className="hidden sm:table-cell text-right">NFs</TableHead>
                    <TableHead className="hidden md:table-cell text-right">Clientes</TableHead>
                    <TableHead className="hidden lg:table-cell text-right">SKUs</TableHead>
                    <TableHead className="hidden lg:table-cell">Participação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cidadesFiltradas.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                        Nenhuma cidade encontrada para os filtros selecionados.
                      </TableCell>
                    </TableRow>
                  )}
                  {cidadesFiltradas.map((row) => (
                    <CidadeRow
                      key={row.cidade}
                      row={row}
                      maxFat={maxFat}
                      onSelectCliente={openClienteDetalhe}
                    />
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(
              cidadesFiltradas.reduce<Record<string, number>>((acc, c) => {
                acc[c.estado] = (acc[c.estado] ?? 0) + c.faturamento_total
                return acc
              }, {})
            )
              .sort(([, a], [, b]) => b - a)
              .map(([uf, fat]) => {
                const denom = faturamentoFiltrado > 0 ? faturamentoFiltrado : 1
                const pct = (fat / denom) * 100
                return (
                  <Card key={uf} className={cn(estadoFilter === uf && 'border-primary/30 bg-primary/5')}>
                    <CardContent>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{uf}</span>
                        <Badge variant="secondary" className="text-[10px]">{pct.toFixed(1)}%</Badge>
                      </div>
                      <p className="text-base font-bold tabular-nums">{formatCurrency(fat)}</p>
                      <div className="mt-2 h-1.5 bg-muted/50 rounded overflow-hidden">
                        <div className="h-full bg-primary/70 rounded" style={{ width: `${pct}%` }} />
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
          </div>
        </TabsContent>

        <TabsContent value="clientes" className="mt-0">
          <p className="text-sm text-muted-foreground mb-4">
            Consulta por CNPJ, razão social ou cidade. Clique em uma linha para ver histórico e mix.
          </p>
          <FilterBar columns={2}>
            <FilterField label="Buscar CNPJ, nome ou cidade">
              <Input
                placeholder="07891234…, Supermercado, Recife…"
                value={buscaCliente}
                onChange={(e) => setBuscaCliente(e.target.value)}
                className="h-8 text-sm"
              />
            </FilterField>
            <FilterField label="Estado">
              <div className="flex gap-1.5 flex-wrap">
                <Button
                  size="sm"
                  variant={estadoCliente === '' ? 'default' : 'outline'}
                  className="h-8 text-xs"
                  onClick={() => setEstadoCliente('')}
                >
                  Todos
                </Button>
                {estados.map((uf) => (
                  <Button
                    key={uf}
                    size="sm"
                    variant={estadoCliente === uf ? 'default' : 'outline'}
                    className="h-8 text-xs"
                    onClick={() => setEstadoCliente(uf)}
                  >
                    {uf}
                  </Button>
                ))}
              </div>
            </FilterField>
          </FilterBar>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="hidden sm:table-cell">Cidade / UF</TableHead>
                    <TableHead className="hidden md:table-cell font-mono text-xs">CNPJ</TableHead>
                    <TableHead className="text-right">Faturamento</TableHead>
                    <TableHead className="hidden lg:table-cell text-right">NFs</TableHead>
                    <TableHead className="hidden lg:table-cell text-right">SKUs</TableHead>
                    <TableHead className="w-8" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientesListaFiltrada.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-10">
                        Nenhum cliente encontrado.
                      </TableCell>
                    </TableRow>
                  )}
                  {clientesListaFiltrada.map((c) => (
                    <TableRow
                      key={c.cnpj_cliente}
                      className="cursor-pointer"
                      onClick={() => openClienteDetalhe(c)}
                    >
                      <TableCell className="font-medium max-w-[200px] truncate">{c.nome_cliente}</TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                        {c.cidade} / {c.estado}
                      </TableCell>
                      <TableCell className="hidden md:table-cell font-mono text-xs text-muted-foreground">
                        {c.cnpj_cliente}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatCurrency(c.faturamento_total)}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-right tabular-nums">{c.total_nfs}</TableCell>
                      <TableCell className="hidden lg:table-cell text-right tabular-nums">{c.total_skus}</TableCell>
                      <TableCell>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
