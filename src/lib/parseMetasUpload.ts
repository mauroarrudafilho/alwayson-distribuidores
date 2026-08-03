import * as XLSX from 'xlsx'
import type { Meta } from '@/types/distribuidor'

const HIERARQUIAS = new Set<Meta['hierarquia']>([
  'distribuidor',
  'gerente',
  'supervisor',
  'vendedor',
])

const TIPOS = new Set<Meta['tipo']>([
  'faturamento',
  'positivacao',
  'mix',
  'clientes_estrategicos',
])

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

export interface MetaUploadRow {
  hierarquia: Meta['hierarquia']
  codigo_externo: string | null
  responsavel: string | null
  tipo: Meta['tipo']
  periodo: string
  valor_meta: number
}

function parsePeriodo(raw: unknown): string | null {
  if (raw == null || raw === '') return null
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return `${raw.getFullYear()}-${String(raw.getMonth() + 1).padStart(2, '0')}`
  }
  const s = String(raw).trim()
  if (/^\d{4}-\d{2}$/.test(s)) return s
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.slice(0, 7)
  return null
}

function parseValor(raw: unknown): number | null {
  if (raw == null || raw === '') return null
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw > 0 ? raw : null
  const n = Number(String(raw).replace(/\./g, '').replace(',', '.').trim())
  return Number.isFinite(n) && n > 0 ? n : null
}

function rowsFromMatrix(matrix: unknown[][]): MetaUploadRow[] {
  if (matrix.length < 2) return []
  const headers = matrix[0].map((h) => String(h ?? ''))
  const iHier = pickColumn(headers, ['hierarquia', 'nivel', 'nível'])
  const iCod = pickColumn(headers, ['codigo_externo', 'codigo', 'código', 'cod_vendedor'])
  const iNome = pickColumn(headers, ['responsavel', 'responsável', 'nome'])
  const iTipo = pickColumn(headers, ['tipo', 'metrica', 'métrica'])
  const iPeriodo = pickColumn(headers, ['periodo', 'período', 'mes', 'mês'])
  const iValor = pickColumn(headers, ['valor_meta', 'meta', 'valor'])

  if (iHier < 0 || iTipo < 0 || iPeriodo < 0 || iValor < 0) {
    throw new Error(
      'Cabeçalhos obrigatórios: hierarquia, tipo, periodo, valor_meta (ou sinônimos).'
    )
  }

  const out: MetaUploadRow[] = []
  for (let r = 1; r < matrix.length; r++) {
    const row = matrix[r]
    if (!row?.length) continue
    const hierRaw = normalizeKey(String(row[iHier] ?? ''))
    if (!hierRaw || hierRaw === 'hierarquia') continue
    const hierarquia = hierRaw as Meta['hierarquia']
    if (!HIERARQUIAS.has(hierarquia)) continue

    const tipoRaw = normalizeKey(String(row[iTipo] ?? ''))
    if (!TIPOS.has(tipoRaw as Meta['tipo'])) continue

    const periodo = parsePeriodo(row[iPeriodo])
    const valor = parseValor(row[iValor])
    if (!periodo || valor === null) continue

    out.push({
      hierarquia,
      codigo_externo: iCod >= 0 ? String(row[iCod] ?? '').trim() || null : null,
      responsavel: iNome >= 0 ? String(row[iNome] ?? '').trim() || null : null,
      tipo: tipoRaw as Meta['tipo'],
      periodo,
      valor_meta: valor,
    })
  }
  return out
}

export function parseMetasCsv(text: string): MetaUploadRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  const matrix = lines.map((l) => l.split(/[,;]/).map((c) => c.trim()))
  return rowsFromMatrix(matrix)
}

export function parseMetasXlsx(buffer: ArrayBuffer): MetaUploadRow[] {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
  const sheet = wb.Sheets[wb.SheetNames[0]!]
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })
  return rowsFromMatrix(matrix as unknown[][])
}
