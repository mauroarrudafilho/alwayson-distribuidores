/**
 * YoY series builder: transforma `[{ano_mes: 'YYYY-MM', metric: number}]` em
 * dados Jan→Dez com uma coluna por ano detectado. Permite renderizar um gráfico
 * com eixo X fixo (Jan..Dez) e uma série/cor por ano.
 *
 * Meses sem dado ficam `undefined` no row — o Recharts desenha gap (use
 * `connectNulls={false}`) ou conecta (use `connectNulls`).
 */

export const MONTHS_PT_SHORT = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
] as const

export type YoyDataPoint = { mes: string; monthIndex: number } & Record<
  string,
  number | string | undefined
>

export interface YoySeriesResult {
  data: YoyDataPoint[]
  years: number[]
}

export function buildYoySeries<T extends { ano_mes: string }>(
  rows: T[],
  valueKey: keyof T
): YoySeriesResult {
  const yearsSet = new Set<number>()
  const map = new Map<number, Map<number, number>>()

  for (const r of rows) {
    const [y, m] = r.ano_mes.split('-')
    const year = Number(y)
    const month = Number(m)
    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) continue
    yearsSet.add(year)
    if (!map.has(year)) map.set(year, new Map())
    const v = Number(r[valueKey])
    if (Number.isFinite(v)) map.get(year)!.set(month - 1, v)
  }

  const years = [...yearsSet].sort((a, b) => a - b)
  const data: YoyDataPoint[] = MONTHS_PT_SHORT.map((mes, idx) => {
    const row: YoyDataPoint = { mes, monthIndex: idx }
    for (const y of years) {
      row[String(y)] = map.get(y)?.get(idx)
    }
    return row
  })

  return { data, years }
}
