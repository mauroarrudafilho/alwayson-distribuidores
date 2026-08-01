import * as XLSX from 'xlsx'

/** Normaliza cabeçalho: minúsculas, sem acento, espaços → _. */
export function normalizeHeader(k) {
  return String(k ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
}

/**
 * @param {Buffer} buffer
 * @returns {{ headers: string[], rows: Record<string, unknown>[] }}
 */
export function readSheetRows(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const sheetName = wb.SheetNames[0]
  if (!sheetName) throw new Error('Arquivo sem planilhas')
  const ws = wb.Sheets[sheetName]
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true })
  if (!aoa.length) return { headers: [], rows: [] }

  const rawHeaders = /** @type {unknown[]} */ (aoa[0] ?? [])
  const headers = rawHeaders.map((h) => normalizeHeader(h))
  /** @type {Record<string, unknown>[]} */
  const rows = []

  for (let i = 1; i < aoa.length; i++) {
    const line = /** @type {unknown[]} */ (aoa[i] ?? [])
    if (!line.some((c) => c !== null && c !== undefined && String(c).trim() !== '')) continue
    /** @type {Record<string, unknown>} */
    const obj = {}
    for (let c = 0; c < headers.length; c++) {
      const key = headers[c]
      if (!key) continue
      obj[key] = line[c] ?? null
    }
    rows.push(obj)
  }
  return { headers, rows }
}

/** Aceita Date, serial Excel, dd/mm/aaaa, mm/dd/yy, ISO. */
export function parseDateCell(raw) {
  if (raw === null || raw === undefined || raw === '') return null
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return toIsoDate(raw)
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const parsed = XLSX.SSF.parse_date_code(raw)
    if (!parsed) return null
    return `${parsed.y}-${pad2(parsed.m)}-${pad2(parsed.d)}`
  }
  const s = String(raw).trim()
  if (!s) return null
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (br) {
    let d = Number(br[1])
    let m = Number(br[2])
    let y = Number(br[3])
    if (y < 100) y += 2000
    // Preferir dd/mm; se dia > 12 e mês ≤ 12, já é dd/mm.
    // Se ambos ≤ 12, assumir dd/mm (padrão BR do template).
    if (d > 12 && m <= 12) {
      /* already d/m */
    } else if (m > 12 && d <= 12) {
      ;[d, m] = [m, d]
    }
    if (m < 1 || m > 12 || d < 1 || d > 31) return null
    return `${y}-${pad2(m)}-${pad2(d)}`
  }
  const t = Date.parse(s)
  if (!Number.isNaN(t)) return toIsoDate(new Date(t))
  return null
}

function toIsoDate(d) {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`
}

function pad2(n) {
  return String(n).padStart(2, '0')
}

/** CNPJ (14) ou CPF (11); descarta zeros. */
export function parseDocumento(raw) {
  if (raw === null || raw === undefined || raw === '') return null
  let digits
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    digits = String(Math.round(raw))
  } else {
    digits = String(raw).replace(/\D/g, '')
  }
  if (!digits) return null
  if (digits.length < 11) digits = digits.padStart(11, '0')
  if (digits.length > 11 && digits.length < 14) digits = digits.padStart(14, '0')
  if (digits.length !== 11 && digits.length !== 14) return null
  if (/^0+$/.test(digits)) return null
  return digits
}

export function parseNumber(raw) {
  if (raw === null || raw === undefined || raw === '') return null
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  const s = String(raw).trim().replace(/\s/g, '').replace(',', '.')
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

export function cellStr(raw) {
  if (raw === null || raw === undefined) return ''
  return String(raw).trim()
}

/**
 * @param {string[]} headers
 * @param {string[]} required
 * @param {Record<string, string[]>} [aliases]
 */
export function missingColumns(headers, required, aliases = {}) {
  const set = new Set(headers)
  const missing = []
  for (const col of required) {
    const alts = [col, ...(aliases[col] ?? [])].map(normalizeHeader)
    if (!alts.some((a) => set.has(a))) missing.push(col)
  }
  return missing
}

/** @param {Record<string, unknown>} row @param {string} key @param {string[]} [alts] */
export function pick(row, key, alts = []) {
  for (const k of [key, ...alts]) {
    const nk = normalizeHeader(k)
    if (nk in row && row[nk] !== null && row[nk] !== undefined && row[nk] !== '') {
      return row[nk]
    }
  }
  return row[normalizeHeader(key)] ?? null
}

/**
 * Variantes de código produto: `178629` ↔ `17.8629` (padrão Campestre XX.YYYY).
 * @param {string} code
 * @returns {string[]}
 */
export function codigoProdutoVariants(code) {
  const raw = String(code ?? '').trim()
  if (!raw) return []
  const digits = raw.replace(/\D/g, '')
  const out = new Set([raw, digits])
  if (digits.length >= 5) {
    const left = digits.slice(0, digits.length - 4)
    const right = digits.slice(-4)
    out.add(`${left}.${right}`)
  }
  if (raw.includes('.')) out.add(raw)
  return [...out].filter(Boolean)
}
