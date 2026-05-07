export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

/**
 * Converte `YYYY-MM-DD` em Date ao meio-dia **local** (dia civil).
 * `new Date('2022-04-30')` usa meia-noite UTC → no BR costuma aparecer como 29/04.
 */
function dateFromIsoDateOnly(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s).trim())
  if (!m) return null
  const y = Number(m[1])
  const mon = Number(m[2]) - 1
  const d = Number(m[3])
  if (!Number.isFinite(y) || !Number.isFinite(mon) || !Number.isFinite(d)) return null
  return new Date(y, mon, d, 12, 0, 0, 0)
}

export function formatDate(date: string | Date): string {
  if (typeof date === 'string') {
    const local = dateFromIsoDateOnly(date)
    if (local) return local.toLocaleDateString('pt-BR')
  }
  if (date instanceof Date && !Number.isNaN(date.getTime())) {
    return date.toLocaleDateString('pt-BR')
  }
  return new Date(date).toLocaleDateString('pt-BR')
}

export function formatDateTime(date: string | Date): string {
  if (typeof date === 'string') {
    const local = dateFromIsoDateOnly(date)
    if (local) {
      return local.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
    }
  }
  return new Date(date).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}
