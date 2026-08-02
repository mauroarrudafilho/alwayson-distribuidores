import {
  Users,
  AlertTriangle,
  FileText,
  TrendingUp,
  Package,
  ArrowUpRight,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/distribuidor/PageHeader'
import { SectionTitle } from '@/components/distribuidor/SectionTitle'
import { StatusBadge } from '@/components/distribuidor/StatusBadge'
import { SnapshotStrip, type SnapshotItem } from '@/components/distribuidor/SnapshotStrip'
import { Panel } from '@/components/distribuidor/Panel'
import { EmptyState } from '@/components/distribuidor/EmptyState'
import { Button } from '@/components/ui/button'
import { useDashboardKPIs } from '@/hooks/useDashboardKPIs'
import { useDistribuidores } from '@/hooks/useDistribuidores'
import { useEstoqueAlertas } from '@/hooks/useEstoque'
import {
  useRelatoriosIngestao,
  useRelatoriosPendentes,
  useDistribuidoresSemDadosRecentes,
} from '@/hooks/useRelatoriosIngestao'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/utils'

function formatCompactBRL(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1).replace('.', ',')}M`
  if (Math.abs(n) >= 1_000) return `R$ ${(n / 1_000).toFixed(0)}k`
  return formatCurrency(n)
}

export function Dashboard() {
  const { data, isLoading } = useDashboardKPIs()
  const { data: distribuidores, isLoading: loadingDist } = useDistribuidores()
  const { data: relatoriosPendentes = 0 } = useRelatoriosPendentes()
  const { data: semDadosRecentes = 0 } = useDistribuidoresSemDadosRecentes()
  const { data: ultimosRelatorios } = useRelatoriosIngestao()
  const { data: estoqueAlertas } = useEstoqueAlertas()

  if (isLoading || loadingDist) {
    return (
      <div className="animate-page-in">
        <PageHeader
          title="Performance"
          accent="consolidada"
          description="visão geral dos parceiros"
        />
        <Skeleton className="mb-6 h-[72px] w-full rounded-lg" />
        <Skeleton className="mb-3 h-16 w-full rounded-lg" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          <Skeleton className="h-64 rounded-lg lg:col-span-3" />
          <Skeleton className="h-64 rounded-lg lg:col-span-2" />
        </div>
      </div>
    )
  }

  const kpis = data?.kpis
  const distAtivos = data?.distribuidoresAtivos ?? 0
  const rankingDistribuidores = data?.rankingDistribuidores ?? []
  const rankingMap = new Map(
    rankingDistribuidores.map((r) => [r.distribuidor_id, r.faturamento])
  )
  const distribuidoresOrdenados =
    distribuidores?.slice().sort((a, b) => {
      const fatA = rankingMap.get(a.id) ?? 0
      const fatB = rankingMap.get(b.id) ?? 0
      return fatB - fatA
    }) ?? []

  const variacao = kpis?.variacao_percentual ?? 0
  const snapshotItems: SnapshotItem[] = [
    {
      label: 'Faturamento',
      value: formatCompactBRL(kpis?.faturamento_periodo ?? 0),
      delta: variacao !== 0 ? `${variacao > 0 ? '+' : ''}${variacao.toFixed(1)}%` : undefined,
      tone: variacao > 0 ? 'up' : variacao < 0 ? 'down' : 'flat',
    },
    {
      label: 'Cobertura',
      value: `${(kpis?.taxa_positivacao ?? 0).toFixed(1)}%`,
      delta: `${kpis?.clientes_positivados ?? 0} pos.`,
      tone: 'flat',
    },
    {
      label: 'Distribuidores',
      value: `${distAtivos}`,
      delta: 'ativos',
      tone: 'flat',
    },
    {
      label: 'Estratégicos',
      value: `${kpis?.clientes_estrategicos_ativos ?? 0} / ${kpis?.clientes_estrategicos_total ?? 0}`,
      delta: kpis?.clientes_estrategicos_total
        ? `${Math.round(((kpis?.clientes_estrategicos_ativos ?? 0) / kpis.clientes_estrategicos_total) * 100)}% ativos`
        : undefined,
      tone: 'up',
    },
    {
      label: 'Itens vendidos',
      value: `${(data?.itensVendidos ?? 0).toLocaleString('pt-BR')}`,
      delta: data?.periodoReferencia
        ? `ref. ${data.periodoReferencia}`
        : 'distintos',
      tone: 'flat',
    },
    {
      label: 'Sem dados',
      value: `${semDadosRecentes}`,
      delta: '> 7 dias',
      tone: semDadosRecentes > 0 ? 'down' : 'flat',
    },
  ]

  const actionItems = [
    {
      label: 'Positivação',
      value: `${kpis?.clientes_positivados ?? 0}/${kpis?.total_clientes_carteira ?? 0}`,
      hint: `${(kpis?.taxa_positivacao ?? 0).toFixed(0)}% cobertura`,
      icon: Users,
      to: '/performance',
      hot: false,
    },
    {
      label: 'Estoque crítico',
      value: String(kpis?.itens_estoque_critico ?? 0),
      hint: 'itens abaixo do mínimo',
      icon: AlertTriangle,
      to: '/estoque',
      hot: (kpis?.itens_estoque_critico ?? 0) > 0,
    },
    {
      label: 'Relatórios',
      value: String(relatoriosPendentes),
      hint: 'pendentes de processamento',
      icon: FileText,
      to: '/ingestao',
      hot: relatoriosPendentes > 0,
    },
  ]

  return (
    <div className="animate-page-in">
      <PageHeader
        title="Performance"
        accent="consolidada"
        description="visão geral dos parceiros"
      />

      <SnapshotStrip items={snapshotItems} className="mb-5" />

      {/* Para agir — strip, não parede de KPI cards */}
      <div className="mb-6">
        <SectionTitle title="Para agir hoje" />
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-border/70 bg-border/60 sm:grid-cols-3">
          {actionItems.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              className={cn(
                'group flex items-center gap-3 bg-card px-4 py-3.5 transition-colors hover:bg-muted/40',
                item.hot && 'bg-destructive/[0.03]'
              )}
            >
              <span
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-md border',
                  item.hot
                    ? 'border-destructive/20 bg-destructive/8 text-destructive'
                    : 'border-border/70 bg-muted/40 text-navy/60'
                )}
              >
                <item.icon className="h-4 w-4" strokeWidth={1.75} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    {item.label}
                  </span>
                  <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-teal" />
                </span>
                <span className="mt-0.5 block font-display text-lg tabular-nums tracking-tight text-foreground">
                  {item.value}
                </span>
                <span className="text-[11px] text-muted-foreground">{item.hint}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Panel accent className="lg:col-span-3">
          <SectionTitle title="Ranking distribuidores" icon={TrendingUp} />
          {distribuidoresOrdenados.length > 0 ? (
            <div className="space-y-0.5">
              {distribuidoresOrdenados.slice(0, 10).map((dist, idx) => (
                <Link
                  key={dist.id}
                  to={`/performance?distribuidor=${dist.id}`}
                  className="group flex items-center justify-between gap-3 rounded-md px-2 py-2 transition-colors hover:bg-muted/40"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className={cn(
                        'w-5 shrink-0 text-right font-display text-sm tabular-nums',
                        idx < 3 ? 'text-teal' : 'text-muted-foreground/50'
                      )}
                    >
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <span className="truncate text-sm font-medium text-foreground transition-colors group-hover:text-navy">
                      {dist.nome}
                    </span>
                    <span className="hidden shrink-0 text-[10px] uppercase tracking-[0.14em] text-muted-foreground sm:inline">
                      {dist.estado}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-[12px] font-medium tabular-nums text-foreground">
                      {formatCurrency(rankingMap.get(dist.id) ?? 0)}
                    </span>
                    <StatusBadge status={dist.status} />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              compact
              icon={TrendingUp}
              title="Sem distribuidores"
              description="Cadastre parceiros para ver o ranking de faturamento."
            />
          )}
        </Panel>

        <div className="flex flex-col gap-4 lg:col-span-2">
          <Panel className="flex-1">
            <SectionTitle
              title="Alertas de estoque"
              icon={Package}
              action={
                <Link to="/estoque">
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    Ver tudo
                  </Button>
                </Link>
              }
            />
            {estoqueAlertas && estoqueAlertas.length > 0 ? (
              <div className="space-y-0.5">
                {estoqueAlertas.slice(0, 6).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-muted/30"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium">
                        {item.sku} — {item.descricao}
                      </p>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {item.distribuidor_nome} · {item.quantidade_atual} un · {item.dias_cobertura}d
                      </p>
                    </div>
                    <StatusBadge status={item.status as 'critico' | 'baixo' | 'saudavel' | 'overstock' | 'ruptura'} />
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                compact
                icon={Package}
                title="Estoque em dia"
                description="Nenhum alerta crítico no momento."
              />
            )}
          </Panel>

          <Panel className="flex-1">
            <SectionTitle
              title="Últimos relatórios"
              icon={FileText}
              action={
                <Link to="/ingestao">
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    Enviar
                  </Button>
                </Link>
              }
            />
            {ultimosRelatorios && ultimosRelatorios.length > 0 ? (
              <div className="space-y-0.5">
                {ultimosRelatorios.slice(0, 5).map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-muted/30"
                  >
                    <span className="truncate text-xs">{r.arquivo_nome}</span>
                    <StatusBadge status={r.status} />
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                compact
                icon={FileText}
                title="Nada recebido"
                description="Envie o primeiro relatório pela ingestão."
              />
            )}
          </Panel>
        </div>
      </div>
    </div>
  )
}
