import type { InsightsCidadeRow, InsightsProdutoRow, InsightsTopCliente } from '@/types/insights'
import type { CidadePerCapita } from '@/lib/insights-per-capita'
import { clienteGapMeses, topClientesPrioritarios } from '@/lib/insights-priority'
import type { InsightsAcaoEstado } from '@/hooks/useInsightsAcoes'

export type InsightsOtica = 'clientes' | 'produtos' | 'territorio'

export type ContextualKpi = {
  id: string
  label: string
  value: string
  subtitle?: string
  variant?: 'default' | 'primary' | 'primary-quiet'
}

function concentracaoPct(cidades: InsightsCidadeRow[], n: number, total: number): number {
  if (total <= 0) return 0
  const sorted = [...cidades].sort((a, b) => b.faturamento_total - a.faturamento_total)
  const sum = sorted.slice(0, n).reduce((s, c) => s + c.faturamento_total, 0)
  return (sum / total) * 100
}

export function buildClientesKpis(
  clientes: InsightsTopCliente[],
  periodoFim: string,
  acaoCounts: Record<'todos' | InsightsAcaoEstado, number>
): ContextualKpi[] {
  const prioritarios = topClientesPrioritarios(clientes, periodoFim, clientes.length)
  const comGap = prioritarios.filter((c) => c.__gapMeses > 0)
  const potencialFat = comGap.reduce((s, c) => s + c.faturamento_total, 0)

  return [
    {
      id: 'candidatos',
      label: 'Candidatos a reativação',
      value: String(comGap.length),
      subtitle: 'Sem compra recente no histórico Arruda',
      variant: 'primary',
    },
    {
      id: 'potencial',
      label: 'Potencial histórico',
      value: formatCompactCurrency(potencialFat),
      subtitle: 'Faturamento dos candidatos no período fechado',
    },
    {
      id: 'pendentes',
      label: 'Pendentes de ação',
      value: String(acaoCounts.pendente),
      subtitle: `${acaoCounts.em_acao} em andamento · ${acaoCounts.resolvido} resolvidos`,
    },
    {
      id: 'carteira',
      label: 'Clientes no filtro',
      value: clientes.length.toLocaleString('pt-BR'),
      subtitle: 'Com histórico de sell-out Insights',
    },
  ]
}

export function buildProdutosKpis(
  produtos: InsightsProdutoRow[],
  fatTotal: number
): ContextualKpi[] {
  const sorted = [...produtos].sort((a, b) => b.faturamento_total - a.faturamento_total)
  let cum = 0
  let skus80 = 0
  for (const p of sorted) {
    cum += p.faturamento_total
    skus80 += 1
    if (fatTotal > 0 && cum / fatTotal >= 0.8) break
  }
  const estrategicos = produtos.filter(
    (p) => p.total_clientes >= 10 && p.faturamento_total >= fatTotal * 0.005
  )

  return [
    {
      id: 'skus',
      label: 'SKUs no filtro',
      value: String(produtos.length),
      variant: 'primary',
    },
    {
      id: 'pareto',
      label: 'SKUs = 80% do fat.',
      value: String(skus80),
      subtitle: 'Concentração de receita no mix histórico',
    },
    {
      id: 'estrategicos',
      label: 'SKUs estratégicos',
      value: String(estrategicos.length),
      subtitle: 'Alta adoção (≥10 clientes) no histórico',
    },
    {
      id: 'alcance',
      label: 'Média clientes / SKU',
      value:
        produtos.length > 0
          ? (
              produtos.reduce((s, p) => s + p.total_clientes, 0) / produtos.length
            ).toFixed(1)
          : '—',
      subtitle: 'Amplitude de penetração por produto',
    },
  ]
}

export function buildTerritorioKpis(
  cidades: InsightsCidadeRow[],
  fatTotal: number,
  perCapita: CidadePerCapita[]
): ContextualKpi[] {
  const top3 = concentracaoPct(cidades, 3, fatTotal)
  const top10 = concentracaoPct(cidades, 10, fatTotal)
  const medianaFatPc =
    perCapita.length > 0
      ? [...perCapita].sort((a, b) => a.faturamento_per_capita - b.faturamento_per_capita)[
          Math.floor(perCapita.length / 2)
        ]?.faturamento_per_capita
      : null

  const comLitros = perCapita.filter((c) => c.volume_per_capita != null)
  const medianaVolPc =
    comLitros.length > 0
      ? [...comLitros].sort(
          (a, b) => (a.volume_per_capita ?? 0) - (b.volume_per_capita ?? 0)
        )[Math.floor(comLitros.length / 2)]?.volume_per_capita
      : null

  const kpis: ContextualKpi[] = [
    {
      id: 'concentracao',
      label: 'Concentração top 3',
      value: `${top3.toFixed(0)}%`,
      subtitle: `Top 10 cidades = ${top10.toFixed(0)}% do faturamento filtrado`,
      variant: 'primary',
    },
    {
      id: 'cidades',
      label: 'Cidades no filtro',
      value: cidades.length.toLocaleString('pt-BR'),
      subtitle: `${perCapita.length} com população IBGE para per capita`,
    },
  ]

  if (medianaFatPc != null) {
    kpis.push({
      id: 'fat_pc',
      label: 'Mediana fat. / habitante',
      value: formatCompactCurrency(medianaFatPc),
      subtitle: 'Histórico Arruda ÷ população municipal (IBGE 2022)',
    })
  }

  if (medianaVolPc != null && comLitros[0]?.unidade_volume) {
    kpis.push({
      id: 'vol_pc',
      label: 'Mediana volume / habitante',
      value: `${medianaVolPc.toFixed(3)} ${comLitros[0].unidade_volume}/hab`,
      subtitle: 'Onde a unidade predominante é litros',
    })
  } else {
    kpis.push({
      id: 'clientes_urb',
      label: 'Clientes distintos',
      value: cidades.reduce((s, c) => s + c.total_clientes, 0).toLocaleString('pt-BR'),
      subtitle: 'Soma nos municípios do filtro',
    })
  }

  return kpis
}

function formatCompactCurrency(value: number): string {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)} mi`
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(1)} mil`
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value)
}

/** Resumo de concentração para callout textual. */
export function buildConcentracaoInsight(
  cidades: InsightsCidadeRow[],
  fatTotal: number
): { top3: number; top5: number; leaderUf?: string; leaderShare: number } {
  const sorted = [...cidades].sort((a, b) => b.faturamento_total - a.faturamento_total)
  const total = fatTotal > 0 ? fatTotal : 1
  const byUf = new Map<string, number>()
  for (const c of cidades) {
    byUf.set(c.estado, (byUf.get(c.estado) ?? 0) + c.faturamento_total)
  }
  const ufSorted = [...byUf.entries()].sort((a, b) => b[1] - a[1])
  const leader = ufSorted[0]
  return {
    top3: (sorted.slice(0, 3).reduce((s, c) => s + c.faturamento_total, 0) / total) * 100,
    top5: (sorted.slice(0, 5).reduce((s, c) => s + c.faturamento_total, 0) / total) * 100,
    leaderUf: leader?.[0],
    leaderShare: leader ? (leader[1] / total) * 100 : 0,
  }
}

export { clienteGapMeses }
