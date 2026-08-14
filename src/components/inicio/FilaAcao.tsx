import {
  Users,
  AlertTriangle,
  FileText,
  Handshake,
  Package,
  ArrowUpRight,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { SectionTitle } from '@/components/distribuidor/SectionTitle'
import { useAuth } from '@/contexts/auth'
import { useDashboardKPIs } from '@/hooks/useDashboardKPIs'
import { useEstoqueAlertas } from '@/hooks/useEstoque'
import {
  useRelatoriosPendentes,
  useDistribuidoresSemDadosRecentes,
} from '@/hooks/useRelatoriosIngestao'
import { useFaturamentoProdutosNaoMapeados } from '@/hooks/useFaturamentoProdutoDePara'
import { cn } from '@/lib/utils'

interface ItemFila {
  label: string
  value: string
  hint: string
  icon: typeof Users
  to: string
  hot: boolean
}

/**
 * Fila de ação do Início — itens clicáveis que levam à tela que resolve o
 * problema (Pacote A do roadmap). Cada item é uma contagem real do banco.
 */
export function FilaAcao() {
  const { isAdmin } = useAuth()
  const { data: kpiData } = useDashboardKPIs()
  const kpis = kpiData?.kpis
  const { data: estoqueAlertas } = useEstoqueAlertas()
  const { data: relatoriosPendentes = 0 } = useRelatoriosPendentes()
  const { data: semDadosRecentes = 0 } = useDistribuidoresSemDadosRecentes()
  const { data: skusNaoMapeados } = useFaturamentoProdutosNaoMapeados({
    enabled: isAdmin,
  })

  const items: ItemFila[] = []
  if (kpis) {
    items.push({
      label: 'Positivação',
      value: `${kpis.clientes_positivados}/${kpis.total_clientes_carteira}`,
      hint: `${(kpis.taxa_positivacao ?? 0).toFixed(0)}% cobertura`,
      icon: Users,
      to: '/performance',
      hot: false,
    })
  }
  if (isAdmin) {
    const totalNaoMapeados = skusNaoMapeados?.length ?? 0
    items.push({
      label: 'SKUs não mapeados',
      value: String(totalNaoMapeados),
      hint: 'curadoria de de-para',
      icon: Package,
      to: '/admin/produtos',
      hot: totalNaoMapeados > 0,
    })
  }
  items.push({
    label: 'Estoque crítico',
    value: String(estoqueAlertas?.length ?? 0),
    hint: 'itens abaixo do mínimo',
    icon: AlertTriangle,
    to: '/estoque',
    hot: (estoqueAlertas?.length ?? 0) > 0,
  })
  items.push({
    label: 'Relatórios',
    value: String(relatoriosPendentes),
    hint: 'pendentes de processamento',
    icon: FileText,
    to: '/parceiros',
    hot: relatoriosPendentes > 0,
  })
  items.push({
    label: 'Sem dados recentes',
    value: String(semDadosRecentes),
    hint: 'distribuidores há > 7 dias',
    icon: Handshake,
    to: '/parceiros',
    hot: semDadosRecentes > 0,
  })

  return (
    <section>
      <SectionTitle title="Fila de ação" />
      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-border/70 bg-border/60 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => (
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
    </section>
  )
}
