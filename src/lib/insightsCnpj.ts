/**
 * Normalização de CNPJ exclusiva do pipeline de **Insights** (sell-out territorial).
 * Não usar para cadastro de clientes ou ingestão de distribuidor sem revisar regras locais.
 *
 * Regras:
 * - Após normalizar, deve ter **exatamente 14 dígitos** (sem completar com zeros à esquerda
 *   salvo nota em `parseInsightsCnpj` para casos raros de planilha sem zero inicial).
 * - `cnpj_cliente` 0 / só zeros / vazio → **excluir** linha do lote de insights.
 * - Evitar confiar em `number` do Excel para CNPJ: preferir célula como texto no export;
 *   quando vier número, só aceitamos se `Number.isSafeInteger` após arredondamento.
 */

const CNPJ_LEN = 14
const RE_SCI = /^-?[\d.]+e[+-]?\d+$/i

export type InsightsCnpjRejectReason =
  | 'empty'
  | 'excluded_zero'
  | 'invalid_length'
  | 'unsafe_number'
  | 'non_numeric'

export type ParseInsightsCnpjResult =
  | { ok: true; cnpj14: string }
  | { ok: false; reason: InsightsCnpjRejectReason }

function isAllZeros14(d: string): boolean {
  return d.length === CNPJ_LEN && /^0+$/.test(d)
}

/**
 * Extrai 14 dígitos para insights. Não valida dígitos verificadores.
 */
export function parseInsightsCnpj(raw: unknown): ParseInsightsCnpjResult {
  if (raw === null || raw === undefined) {
    return { ok: false, reason: 'empty' }
  }

  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const rounded = Math.round(raw)
    if (!Number.isSafeInteger(rounded) || rounded <= 0) {
      return { ok: false, reason: rounded === 0 ? 'excluded_zero' : 'unsafe_number' }
    }
    const asStr = String(rounded)
    if (asStr.length > CNPJ_LEN) {
      return { ok: false, reason: 'invalid_length' }
    }
    const padded = asStr.length < CNPJ_LEN ? asStr.padStart(CNPJ_LEN, '0') : asStr
    if (padded.length !== CNPJ_LEN) {
      return { ok: false, reason: 'invalid_length' }
    }
    if (isAllZeros14(padded)) {
      return { ok: false, reason: 'excluded_zero' }
    }
    return { ok: true, cnpj14: padded }
  }

  const s = String(raw).trim()
  if (!s) {
    return { ok: false, reason: 'empty' }
  }

  if (RE_SCI.test(s)) {
    const n = Number(s)
    if (!Number.isFinite(n) || n <= 0) {
      return { ok: false, reason: 'excluded_zero' }
    }
    const rounded = Math.round(n)
    if (!Number.isSafeInteger(rounded)) {
      return { ok: false, reason: 'unsafe_number' }
    }
    const asStr = String(rounded)
    if (asStr.length > CNPJ_LEN) {
      return { ok: false, reason: 'invalid_length' }
    }
    const padded = asStr.length < CNPJ_LEN ? asStr.padStart(CNPJ_LEN, '0') : asStr
    if (padded.length !== CNPJ_LEN) {
      return { ok: false, reason: 'invalid_length' }
    }
    if (isAllZeros14(padded)) {
      return { ok: false, reason: 'excluded_zero' }
    }
    return { ok: true, cnpj14: padded }
  }

  const digits = s.replace(/\D/g, '')
  if (digits.length === 0) {
    return { ok: false, reason: 'empty' }
  }
  // CNPJ com 13 dígitos na planilha = zero à esquerda omitido pelo Excel numérico
  if (digits.length < CNPJ_LEN) {
    const padded = digits.padStart(CNPJ_LEN, '0')
    if (padded.length !== CNPJ_LEN) {
      return { ok: false, reason: 'invalid_length' }
    }
    if (isAllZeros14(padded)) {
      return { ok: false, reason: 'excluded_zero' }
    }
    return { ok: true, cnpj14: padded }
  }
  if (digits.length > CNPJ_LEN) {
    return { ok: false, reason: 'invalid_length' }
  }
  if (isAllZeros14(digits)) {
    return { ok: false, reason: 'excluded_zero' }
  }
  if (!/^\d{14}$/.test(digits)) {
    return { ok: false, reason: 'non_numeric' }
  }
  return { ok: true, cnpj14: digits }
}

/** Se true, a linha de insights deve ser ignorada (não inserir NF/item). */
export function shouldExcludeInsightsRowCnpj(raw: unknown): boolean {
  const r = parseInsightsCnpj(raw)
  return !r.ok
}

/** Raiz CNPJ (8 dígitos; trecho antes de `/` na máscara XX.XXX.XXX/XXXX-XX). */
export function cnpjRaiz8(cnpj14Raw: string | null | undefined): string {
  const p = parseInsightsCnpj(cnpj14Raw ?? '')
  const d = p.ok
    ? p.cnpj14
    : String(cnpj14Raw ?? '')
        .replace(/\D/g, '')
        .padStart(14, '0')
        .slice(-14)
  if (d.length !== 14 || !/^\d{14}$/.test(d)) return ''
  return d.slice(0, 8)
}

/** Ex.: `98521909` → `98.521.909` (raiz formatada). */
export function formatCnpjRaizDisplay(raiz8: string): string {
  const s = raiz8.replace(/\D/g, '').slice(0, 8).padStart(8, '0')
  if (s.length !== 8) return raiz8.trim() || '—'
  return `${s.slice(0, 2)}.${s.slice(2, 5)}.${s.slice(5, 8)}`
}
