import {
  DollarSign,
  Building2,
  Users,
  Award,
  Target,
  AlertTriangle,
  Clock,
  FileText,
  TrendingUp,
  Package,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/distribuidor/PageHeader'
import { KPICard } from '@/components/distribuidor/KPICard'
import { KPIGrid } from '@/components/distribuidor/KPIGrid'
import { SectionTitle } from '@/components/distribuidor/SectionTitle'
import { StatusBadge } from '@/components/distribuidor/StatusBadge'
import { Card, CardContent } from '@/components/ui/card'
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

export function Dashboard() {
  const { data, isLoading } = useDashboardKPIs()
  const { data: distribuidores, isLoading: loadingDist } = useDistribuidores()
  const { data: relatoriosPendentes = 0 } = useRelatoriosPendentes()
  const { data: semDadosRecentes = 0 } = useDistribuidoresSemDadosRecentes()
  const { data: ultimosRelatorios } = useRelatoriosIngestao()
  const { data: estoqueAlertas } = useEstoqueAlertas()

  if (isLoading || loadingDist) {
    return (
      <div>
        <PageHeader
          title="Dashboard"
          description="Visão geral dos distribuidores parceiros"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {Array.from({ length: 8 }).map((_, i) => (
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

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Dashboard"
        description="Visão geral dos distribuidores parceiros"
      />

      <KPIGrid columns={4}>
        <KPICard
          label="Faturamento Período"
          value={formatCurrency(kpis?.faturamento_periodo ?? 0)}
          icon={DollarSign}
          variant="primary"
          trend={
            kpis?.variacao_percentual
              ? {
                  value: kpis.variacao_percentual,
                  positive: kpis.variacao_percentual > 0,
                }
              : undefined
          }
        />
        <KPICard
          label="Distribuidores Ativos"
          value={distAtivos}
          icon={Building2}
        />
        <KPICard
          label="Clientes Positivados"
          value={`${kpis?.clientes_positivados ?? 0} / ${kpis?.total_clientes_carteira ?? 0}`}
          icon={Users}
          badge={`${(kpis?.taxa_positivacao ?? 0).toFixed(0)}%`}
        />
        <KPICard
          label="Plano Excelência"
          value={`${kpis?.clientes_excelencia_ativos ?? 0} / ${kpis?.clientes_excelencia_total ?? 0}`}
          icon={Award}
          variant="primary"
        />
      </KPIGrid>

      <div className="mt-6">
        <KPIGrid columns={4}>
          <KPICard
            label="Metas Atingidas"
            value={`${kpis?.metas_atingidas ?? 0} / ${kpis?.total_metas ?? 0}`}
            icon={Target}
          />
          <KPICard
            label="Estoque Crítico"
            value={kpis?.itens_estoque_critico ?? 0}
            icon={AlertTriangle}
          />
          <KPICard
            label="Sem Dados Recentes"
            value={semDadosRecentes}
            icon={Clock}
            subtitle="> 7 dias sem atualização"
          />
          <KPICard
            label="Relatórios Pendentes"
            value={relatoriosPendentes}
            icon={FileText}
          />
        </KPIGrid>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
        <Card>
          <CardContent className="p-3">
            <SectionTitle title="Ranking Distribuidores" icon={TrendingUp} />
            {distribuidoresOrdenados.length > 0 ? (
              <div className="space-y-1">
                {distribuidoresOrdenados.slice(0, 10).map((dist, idx) => (
                  <Link
                    key={dist.id}
                    to={`/performance?distribuidor=${dist.id}`}
                    className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/30 transition-colors group"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-muted-foreground w-4">
                        {idx + 1}
                      </span>
                      <span className="text-xs font-medium text-foreground group-hover:text-primary transition-colors">
                        {dist.nome}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {dist.estado}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-medium text-foreground">
                        {formatCurrency(rankingMap.get(dist.id) ?? 0)}
                      </span>
                      <StatusBadge status={dist.status} />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground py-4 text-center">
                Nenhum distribuidor cadastrado
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <SectionTitle title="Alertas de Estoque" icon={Package} />
              <Link to="/estoque">
                <Button variant="outline" size="sm" className="h-6 px-2 text-[11px]">
                  Ver tudo
                </Button>
              </Link>
            </div>
            {estoqueAlertas && estoqueAlertas.length > 0 ? (
              <div className="space-y-1">
                {estoqueAlertas.slice(0, 8).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/30"
                  >
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="text-xs font-medium truncate">
                        {item.sku} — {item.descricao}
                      </span>
                      <span className="text-[10px] text-muted-foreground truncate">
                        {item.distribuidor_nome} · {item.quantidade_atual} un · {item.dias_cobertura}d cobertura
                      </span>
                    </div>
                    <StatusBadge status={item.status as any} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground py-4 text-center">
                Nenhum alerta de estoque no momento
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <SectionTitle title="Últimos Relatórios" icon={FileText} />
              <Link to="/ingestao">
                <Button variant="outline" size="sm" className="h-6 px-2 text-[11px]">
                  Enviar
                </Button>
              </Link>
            </div>
            {ultimosRelatorios && ultimosRelatorios.length > 0 ? (
              <div className="space-y-1">
                {ultimosRelatorios.slice(0, 5).map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/30"
                  >
                    <span className="text-xs truncate max-w-[140px]">
                      {r.arquivo_nome}
                    </span>
                    <StatusBadge status={r.status} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground py-4 text-center">
                Nenhum relatório recebido
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
