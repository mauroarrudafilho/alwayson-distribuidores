export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

/**
 * Aplica máscara CNPJ XX.XXX.XXX/XXXX-XX. Normaliza para 14 dígitos
 * (preenche zero à esquerda). Retorna '' se input vazio.
 */
export function formatCnpj(raw: string | null | undefined): string {
  const d = String(raw ?? '').replace(/\D/g, '')
  if (!d) return ''
  const c = d.padStart(14, '0').slice(-14)
  return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12, 14)}`
}

/**
 * Une cidade + UF em "Cidade / UF". Retorna '' quando ambos vazios para
 * evitar artefactos visuais tipo "/" sozinho ou "— / —".
 */
export function formatCidadeUf(cidade: string | null | undefined, uf: string | null | undefined): string {
  const c = (cidade ?? '').trim()
  const u = (uf ?? '').trim()
  if (!c && !u) return ''
  if (c && u) return `${c} / ${u}`
  return c || u
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
