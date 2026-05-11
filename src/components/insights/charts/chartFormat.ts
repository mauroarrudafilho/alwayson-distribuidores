import { formatCurrency } from '@/lib/format'

/** Eixo Y / tooltips com valores grandes */
export function formatCurrencyCompact(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) {
    return `R$ ${(value / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`
  }
  if (abs >= 1_000) {
    return `R$ ${(value / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mil`
  }
  return formatCurrency(value)
}

export function formatPercent(value: number, digits = 1): string {
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: digits, minimumFractionDigits: digits })}%`
}

export function formatInt(value: number): string {
  return Math.round(value).toLocaleString('pt-BR')
}
