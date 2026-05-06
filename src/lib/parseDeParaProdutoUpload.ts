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
    const codigo_cliente = String(cells[colCliente] ?? '').trim()
    const sku_fornecedor = String(cells[colFornec] ?? '').trim()
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
    let codigo_cliente = (cellC?.w ?? row[colCliente] ?? '').toString().trim()
    let sku_fornecedor = (cellS?.w ?? row[colFornec] ?? '').toString().trim()
    if (!codigo_cliente && cellC?.v != null) codigo_cliente = String(cellC.v).trim()
    if (!sku_fornecedor && cellS?.v != null) {
      const v = cellS.v
      sku_fornecedor =
        typeof v === 'number'
          ? (Number.isInteger(v) ? String(v) : String(v))
          : String(v).trim()
    }
    if (!codigo_cliente || !sku_fornecedor) continue
    out.push({ codigo_cliente, sku_fornecedor })
  }
  return out
}
