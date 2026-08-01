/**
 * Escopo territorial do Insights: sell-out Arruda no Nordeste.
 * UFs fora desta lista (ex.: SP, RS, PR, MG, DF) não entram na análise.
 */
export const INSIGHTS_UFS_NORDESTE = [
  'AL',
  'BA',
  'CE',
  'MA',
  'PB',
  'PE',
  'PI',
  'RN',
  'SE',
] as const

export type InsightsUfNordeste = (typeof INSIGHTS_UFS_NORDESTE)[number]

const NE_SET = new Set<string>(INSIGHTS_UFS_NORDESTE)

export function isInsightsUfNordeste(uf: string | null | undefined): boolean {
  if (!uf) return false
  return NE_SET.has(uf.trim().toUpperCase())
}

export function filterInsightsByNordeste<T extends { estado?: string | null }>(
  rows: T[]
): T[] {
  return rows.filter((r) => isInsightsUfNordeste(r.estado))
}

/** Códigos IBGE das UFs do Nordeste (para filtrar malha GeoJSON). */
export const INSIGHTS_UF_CODES_NORDESTE: Record<InsightsUfNordeste, number> = {
  AL: 27,
  BA: 29,
  CE: 23,
  MA: 21,
  PB: 25,
  PE: 26,
  PI: 22,
  RN: 24,
  SE: 28,
}
