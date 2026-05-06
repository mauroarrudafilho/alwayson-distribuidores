#!/usr/bin/env node
/**
 * Normaliza códigos de produto no padrão Campestre: 6 dígitos sem separador → XX.YYYY
 * (ex.: 115004 → 11.5004). Não altera valores que já contêm ".", nem números fora [100000–999999].
 *
 * Colunas afetadas (cabeçalho exato após trim): sku, codprod_fornecedor, sku_fornecedor, Código
 *
 * Uso: node scripts/normalizar-codigos-campestre-xx-yyyy.mjs [arquivo.xlsx ...]
 * Sem argumentos: processa o GA_VGF em docs/ e todos os .xlsx em docs/faturamento-chunks-por-cod-emp/
 */

import * as XLSX from 'xlsx'
import { readFileSync, readdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const COLS = new Set(['sku', 'codprod_fornecedor', 'sku_fornecedor', 'codigo'])

function normalizeProductCode(v) {
  if (v === '' || v === null || v === undefined) return v
  if (typeof v === 'string') {
    const t = v.trim()
    if (t === '') return v
    if (t.includes('.')) return v
    if (/^\d{6}$/.test(t)) return `${t.slice(0, 2)}.${t.slice(2)}`
    return v
  }
  if (typeof v === 'number' && Number.isFinite(v)) {
    const n = Math.round(v)
    if (n < 100000 || n > 999999) return v
    if (!Number.isInteger(v) && Math.abs(v - n) > 1e-6) return v
    const s = String(n).padStart(6, '0')
    return `${s.slice(0, 2)}.${s.slice(2)}`
  }
  return v
}

function normalizeHeaderName(h) {
  return String(h ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function processSheet(ws) {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true })
  if (rows.length < 1) return { rows, changed: 0 }
  const header = rows[0].map((c) => String(c ?? '').trim())
  const norm = header.map(normalizeHeaderName)
  const colIdx = []
  for (let i = 0; i < norm.length; i++) {
    if (COLS.has(norm[i])) colIdx.push(i)
  }
  if (colIdx.length === 0) return { rows, changed: 0 }
  let changed = 0
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]
    for (const c of colIdx) {
      const prev = row[c]
      const next = normalizeProductCode(prev)
      if (String(prev) !== String(next)) {
        row[c] = next
        changed++
      }
    }
  }
  return { rows, changed }
}

function processWorkbook(buf) {
  const wb = XLSX.read(buf, { type: 'buffer' })
  let total = 0
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name]
    const { rows, changed } = processSheet(ws)
    total += changed
    if (changed > 0) {
      const nws = XLSX.utils.aoa_to_sheet(rows)
      wb.Sheets[name] = nws
    }
  }
  return { wb, total }
}

function defaultPaths() {
  const root = join(__dirname, '..')
  const ga = join(
    root,
    'docs',
    'GA_VGF_FATURAMENTOGLOBAL (GRUPOARRUDAPRD)_GA_VGF_FATURAMENTOGLOBAL_REV.xlsx'
  )
  const chunkDir = join(root, 'docs', 'faturamento-chunks-por-cod-emp')
  const out = []
  if (existsSync(ga)) out.push(ga)
  if (existsSync(chunkDir)) {
    for (const f of readdirSync(chunkDir)) {
      if (f.endsWith('.xlsx')) out.push(join(chunkDir, f))
    }
  }
  return out
}

const paths =
  process.argv.length > 2 ? process.argv.slice(2) : defaultPaths()

for (const p of paths) {
  if (!existsSync(p)) {
    console.warn('Ignorado (não encontrado):', p)
    continue
  }
  const buf = readFileSync(p)
  const { wb, total } = processWorkbook(buf)
  XLSX.writeFile(wb, p)
  console.log(total ? `✓ ${p} — ${total} células ajustadas` : `— ${p} — sem alterações`)
}
