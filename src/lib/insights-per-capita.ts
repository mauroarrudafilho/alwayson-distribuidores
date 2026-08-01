import type { InsightsCidadeRow } from '@/types/insights'
import { cidadeUfKey } from '@/lib/ibge-populacao'

export type CidadePerCapita = InsightsCidadeRow & {
  populacao: number
  faturamento_per_capita: number
  /** Volume / habitante — só quando unidade predominante indica litros. */
  volume_per_capita?: number
  unidade_volume?: string
}

const LITRO_UNIDADES = new Set(['l', 'lt', 'litro', 'litros', 'ltr'])

function isLitroUnidade(u: string | undefined | null): boolean {
  if (!u) return false
  return LITRO_UNIDADES.has(u.trim().toLowerCase())
}

export function enriquecerCidadesPerCapita(
  cidades: InsightsCidadeRow[],
  populacao: Map<string, number>
): CidadePerCapita[] {
  const out: CidadePerCapita[] = []
  for (const c of cidades) {
    const pop = populacao.get(cidadeUfKey(c.cidade, c.estado))
    if (!pop || pop <= 0) continue
    const fatPc = c.faturamento_total / pop
    const row: CidadePerCapita = {
      ...c,
      populacao: pop,
      faturamento_per_capita: fatPc,
    }
    if (isLitroUnidade(c.unidade_predominante) && (c.quantidade_litros ?? 0) > 0) {
      row.volume_per_capita = (c.quantidade_litros ?? 0) / pop
      row.unidade_volume = 'L'
    } else if (isLitroUnidade(c.unidade_predominante) && c.quantidade_total > 0) {
      row.volume_per_capita = c.quantidade_total / pop
      row.unidade_volume = c.unidade_predominante
    }
    out.push(row)
  }
  return out
}

/**
 * Score de oportunidade: mistura intensidade (fat/hab) com escala (fat total + clientes).
 * Evita ranquear só vilarejos com 1 cliente e fat/hab artificialmente alto.
 */
export function oportunidadePerCapitaScore(c: CidadePerCapita): number {
  return (
    c.faturamento_per_capita *
    Math.log10(c.faturamento_total + 10) *
    Math.log(c.total_clientes + 1)
  )
}

/** Top oportunidades com contexto de escala — default 24 para grade em 3 colunas. */
export function topOportunidadePerCapita(
  cidades: CidadePerCapita[],
  limit = 24
): CidadePerCapita[] {
  return [...cidades]
    .filter((c) => c.populacao >= 2_000 && c.total_clientes >= 2)
    .sort((a, b) => oportunidadePerCapitaScore(b) - oportunidadePerCapitaScore(a))
    .slice(0, limit)
}

/** Cidades subpenetradas: muitos clientes históricos mas fat/capita abaixo da mediana. */
export function cidadesSubpenetradas(
  cidades: CidadePerCapita[],
  limit = 10
): CidadePerCapita[] {
  if (cidades.length < 4) return []
  const sorted = [...cidades].sort((a, b) => a.faturamento_per_capita - b.faturamento_per_capita)
  const mediana = sorted[Math.floor(sorted.length / 2)]?.faturamento_per_capita ?? 0
  return [...cidades]
    .filter((c) => c.faturamento_per_capita < mediana && c.total_clientes >= 5)
    .sort((a, b) => b.total_clientes - a.total_clientes)
    .slice(0, limit)
}

export function formatPerCapitaCurrency(value: number): string {
  if (value >= 1) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(value)
}

export function formatVolumePerCapita(value: number, unidade?: string): string {
  const u = unidade?.trim() || 'un'
  const n = value >= 0.01 ? value.toFixed(2) : value.toFixed(4)
  return `${n} ${u}/hab`
}
