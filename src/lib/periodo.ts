/** Helpers de período `YYYY-MM` usados em Performance / Dashboard / Insights. */

/** Início do ciclo vivo do distribuidor no Insights (sell-out atual). */
export const INSIGHTS_CICLO_VIVO_INICIO = '2025-01'

export function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

/** Jan/2025 → mês vigente do sistema — sell-out atual no fluxo Insights. */
export function insightsCicloVivoPeriodo(): { inicio: string; fim: string } {
  return { inicio: INSIGHTS_CICLO_VIVO_INICIO, fim: getCurrentMonth() }
}

/** Mês corrente menos N meses (`YYYY-MM`). */
export function getMonthOffset(monthsBack: number): string {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - monthsBack)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function monthStart(ym: string): string {
  return `${ym}-01`
}

export function monthEnd(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  const last = new Date(y, m, 0).getDate()
  return `${ym}-${String(last).padStart(2, '0')}`
}

export function prevMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Dias entre duas datas ISO (início → fim), arredondado para baixo. */
export function diasEntre(inicioIso: string, fimIso: string): number {
  const ini = new Date(inicioIso.includes('T') ? inicioIso : `${inicioIso}T12:00:00`)
  const fim = new Date(fimIso.includes('T') ? fimIso : `${fimIso}T12:00:00`)
  if (Number.isNaN(ini.getTime()) || Number.isNaN(fim.getTime())) return 0
  return Math.floor((fim.getTime() - ini.getTime()) / 86_400_000)
}
