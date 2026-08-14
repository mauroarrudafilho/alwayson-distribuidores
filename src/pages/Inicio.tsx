import { PageHeader } from '@/components/distribuidor/PageHeader'
import { SnapshotStrip, type SnapshotItem } from '@/components/distribuidor/SnapshotStrip'
import { Skeleton } from '@/components/ui/skeleton'
import { RitmoMes } from '@/components/inicio/RitmoMes'
import { FilaAcao } from '@/components/inicio/FilaAcao'
import { Destaques } from '@/components/inicio/Destaques'
import { SaudeDado } from '@/components/inicio/SaudeDado'
import { useDashboardKPIs } from '@/hooks/useDashboardKPIs'
import { useDistribuidores } from '@/hooks/useDistribuidores'
import { useDistribuidoresSemDadosRecentes } from '@/hooks/useRelatoriosIngestao'
import { formatBRLCompact } from '@/lib/format'

/**
 * Início (Pacote A do roadmap) — o que o KAM precisa saber e fazer hoje, não
 * uma foto estática: ritmo do mês, fila de ação, destaques e saúde do dado.
 */
export function Inicio() {
  const { data, isLoading } = useDashboardKPIs()
  const { isLoading: loadingDist } = useDistribuidores()
  const { data: semDadosRecentes = 0 } = useDistribuidoresSemDadosRecentes()

  const kpis = data?.kpis
  const variacao = kpis?.variacao_percentual ?? 0

  const snapshotItems: SnapshotItem[] = [
    {
      label: 'Faturamento',
      value: formatBRLCompact(kpis?.faturamento_periodo ?? 0),
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
      value: `${data?.distribuidoresAtivos ?? 0}`,
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

  if (isLoading || loadingDist) {
    return (
      <div className="animate-page-in">
        <PageHeader
          title="Início"
          accent="do dia"
          description="o que precisa de atenção hoje nos parceiros"
        />
        <Skeleton className="mb-6 h-[72px] w-full rounded-lg" />
        <Skeleton className="mb-3 h-32 w-full rounded-lg" />
        <Skeleton className="mb-3 h-16 w-full rounded-lg" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          <Skeleton className="h-64 rounded-lg lg:col-span-2" />
          <Skeleton className="h-64 rounded-lg lg:col-span-3" />
        </div>
      </div>
    )
  }

  return (
    <div className="animate-page-in">
      <PageHeader
        title="Início"
        accent="do dia"
        description="o que precisa de atenção hoje nos parceiros"
      />

      <SnapshotStrip items={snapshotItems} className="mb-5" />

      <div className="mb-5">
        <RitmoMes />
      </div>

      <div className="mb-5">
        <FilaAcao />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <Destaques />
        </div>
        <div className="lg:col-span-3">
          <SaudeDado />
        </div>
      </div>
    </div>
  )
}
