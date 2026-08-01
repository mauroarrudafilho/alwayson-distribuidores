import { formatCurrency } from '@/lib/format'

export type MetricaAnalise = 'faturamento' | 'unidade'

export function formatMetricaValor(value: number, metrica: MetricaAnalise, unidade?: string): string {
  if (metrica === 'faturamento') return formatCurrency(value)
  const suffix = unidade ? ` ${unidade}` : ' un'
  return `${value.toLocaleString('pt-BR')}${suffix}`
}

export function metricaLabel(metrica: MetricaAnalise): string {
  return metrica === 'faturamento' ? 'Faturamento' : 'Unidade'
}
