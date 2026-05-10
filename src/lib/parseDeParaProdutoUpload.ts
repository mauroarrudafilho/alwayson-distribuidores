import * as XLSX from 'xlsx'

const CLIENT_ALIASES = [
  'codigo_cliente',
  'código_cliente',
  'cod_cliente',
  'sku_cliente',
  'codigo interno',
  'código interno',
  /* Insights / GA vendas territorial */
  'codigo_origem',
  'código_origem',
  'codprod_fornecedor',
  'codprod fornecedor',
  'codigo_insights',
  'código_insights',
]
const SUPPLIER_ALIASES = [
  'sku_fornecedor',
  'codigo_fornecedor',
  'código_fornecedor',
  'sku_fornecedor_campestre',
  'sku oficial',
  'codigo fornecedor',
  'código fornecedor',
]

function normalizeKey(k: string): string {
  return k
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
}

function pickColumn(headers: string[], aliases: string[]): number {
  const norm = headers.map((h) => normalizeKey(String(h)))
  for (const a of aliases) {
    const i = norm.indexOf(normalizeKey(a))
    if (i >= 0) return i
  }
  return -1
}

export interface DeParaProdutoRow {
  codigo_cliente: string
  sku_fornecedor: string
}

/**
 * Normaliza códigos vindos de CSV/Excel para bater com `alwayson_produtos.sku` (padrão XX.YYYY):
 * - Inteiro 100000–999999 → "XX.YYYY" (ex.: 117004 → 11.7004), igual ao script Campestre do repo
 * - Número decimal (Excel) → 4 casas, evitando lixo IEEE (ex.: 11.700400000002 → 11.7004)
 * - Texto "11,7004" ou com espaços finos → ponto decimal + arredondamento
 */
export function normalizeDeParaCellValue(raw: unknown): string {
  if (raw === '' || raw == null) return ''
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const ri = Math.round(raw)
    if (raw === ri && ri >= 100_000 && ri <= 999_999) {
      const digits = String(ri)
      return `${digits.slice(0, 2)}.${digits.slice(2)}`
    }
    if (raw === ri) return String(ri)
    const r = Math.round(raw * 10_000) / 10_000
    return r.toFixed(4)
  }
  let s = String(raw).trim().replace(/\u00a0/g, '').replace(',', '.')
  if (!s) return ''
  if (/^\d{6}$/.test(s)) return `${s.slice(0, 2)}.${s.slice(2)}`
  if (/^\d+\.\d+$/.test(s)) {
    const n = Number(s)
    if (!Number.isFinite(n)) return s
    const r = Math.round(n * 10_000) / 10_000
    return r.toFixed(4)
  }
  return s
}

export function parseDeParaCsv(text: string): DeParaProdutoRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return []
  const sep = lines[0].includes(';') && !lines[0].includes(',') ? ';' : ','
  const headerCells = lines[0].split(sep).map((c) => c.trim().replace(/^"|"$/g, ''))
  const ci = pickColumn(headerCells, CLIENT_ALIASES)
  const si = pickColumn(headerCells, SUPPLIER_ALIASES)
  let colCliente = ci
  let colFornec = si
  if (colCliente < 0 || colFornec < 0) {
    if (headerCells.length >= 2) {
      colCliente = 0
      colFornec = 1
    } else return []
  }
  const out: DeParaProdutoRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(sep).map((c) => c.trim().replace(/^"|"$/g, ''))
    const codigo_cliente = normalizeDeParaCellValue(String(cells[colCliente] ?? '').trim())
    const sku_fornecedor = normalizeDeParaCellValue(String(cells[colFornec] ?? '').trim())
    if (!codigo_cliente || !sku_fornecedor) continue
    out.push({ codigo_cliente, sku_fornecedor })
  }
  return out
}

export function parseDeParaXlsx(buffer: ArrayBuffer): DeParaProdutoRow[] {
  const wb = XLSX.read(buffer, { type: 'array' })
  const name =
    wb.SheetNames.find((n) => /de[_\s-]?para/i.test(n)) ?? wb.SheetNames[0]
  const ws = wb.Sheets[name]
  if (!ws) return []
  const rows = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(
    ws,
    { header: 1, defval: '', raw: true }
  )
  if (rows.length < 2) return []
  const header = (rows[0] as unknown[]).map((c) => String(c ?? ''))
  let colCliente = pickColumn(header, CLIENT_ALIASES)
  let colFornec = pickColumn(header, SUPPLIER_ALIASES)
  if (colCliente < 0 || colFornec < 0) {
    if (header.length >= 2) {
      colCliente = 0
      colFornec = 1
    } else return []
  }
  const out: DeParaProdutoRow[] = []
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] as unknown[]
    const addrC = XLSX.utils.encode_cell({ r: i, c: colCliente })
    const addrS = XLSX.utils.encode_cell({ r: i, c: colFornec })
    const cellC = ws[addrC] as { w?: string; v?: unknown } | undefined
    const cellS = ws[addrS] as { w?: string; v?: unknown } | undefined
    let codigo_cliente = ''
    if (cellC?.w != null && String(cellC.w).trim() !== '') {
      codigo_cliente = normalizeDeParaCellValue(String(cellC.w).trim())
    } else if (cellC?.v != null) {
      codigo_cliente = normalizeDeParaCellValue(cellC.v)
    } else {
      codigo_cliente = normalizeDeParaCellValue(row[colCliente])
    }

    let sku_fornecedor = ''
    if (cellS?.w != null && String(cellS.w).trim() !== '') {
      sku_fornecedor = normalizeDeParaCellValue(String(cellS.w).trim())
    } else if (cellS?.v != null) {
      sku_fornecedor = normalizeDeParaCellValue(cellS.v)
    } else {
      sku_fornecedor = normalizeDeParaCellValue(row[colFornec])
    }

    if (!codigo_cliente || !sku_fornecedor) continue
    out.push({ codigo_cliente, sku_fornecedor })
  }
  return out
}
