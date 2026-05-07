#!/usr/bin/env node
/**
 * Compara CNPJs únicos do chunk GA cod_emp-15 (planilha local) vs alwayson_insights_nf (cod_emp=15).
 * Uso: node scripts/compare-cod15-sheet-vs-db.mjs
 */
/* eslint-disable no-console */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

for (const f of ['.env.local', '.env']) {
  const p = path.join(ROOT, f)
  if (!fs.existsSync(p)) continue
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq < 1) continue
    const key = t.slice(0, eq).trim()
    let val = t.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
      val = val.slice(1, -1)
    if (!(key in process.env)) process.env[key] = val
  }
  break
}

const SHEET = path.join(
  ROOT,
  'docs/faturamento-chunks-por-cod-emp/GA_VGF_FATURAMENTOGLOBAL_GRUPOARRUDAPRD__GA_VGF_FATURAMENTOGLOBAL_REV_cod_emp-15.xlsx'
)

function parseCnpj(raw) {
  if (raw == null) return null
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const str = String(Math.round(raw))
    const d = str.length < 14 ? str.padStart(14, '0') : str.slice(-14)
    return /^\d{14}$/.test(d) && !/^0{14}$/.test(d) ? d : null
  }
  const s = String(raw).trim()
  if (!s) return null
  const digits = s.replace(/\D/g, '')
  if (!digits.length) return null
  const d = digits.length < 14 ? digits.padStart(14, '0') : digits.slice(-14)
  if (!/^\d{14}$/.test(d) || /^0{14}$/.test(d)) return null
  return d
}

const wb = XLSX.read(fs.readFileSync(SHEET), { type: 'buffer' })
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' })
const cnKey = Object.keys(rows[0] ?? {}).find((k) => /cnpj/i.test(k) && /cliente/i.test(k))
const sheet = new Set()
for (const r of rows) {
  const n = parseCnpj(cnKey ? r[cnKey] : null)
  if (n) sheet.add(n)
}

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (.env.local).')
  process.exit(1)
}

const sb = createClient(url.replace(/\/$/, ''), key, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const { data: nfs, error } = await sb
  .from('alwayson_insights_nf')
  .select('cnpj_cliente')
  .eq('cod_emp', '15')
  .limit(10000)

if (error) {
  console.error('Supabase:', error.message)
  process.exit(1)
}

const db = new Set()
for (const row of nfs ?? []) {
  const n = parseCnpj(row.cnpj_cliente)
  if (n) db.add(n)
}

const missingInDb = [...sheet].filter((c) => !db.has(c)).sort()
const extraInDb = [...db].filter((c) => !sheet.has(c)).sort()

console.log('Planilha:', path.basename(SHEET))
console.log('Únicos na planilha:', sheet.size)
console.log('Linhas NF (cod_emp=15) no banco:', nfs?.length ?? 0)
console.log('Únicos no banco (NFs):', db.size)
console.log('Na planilha, ausentes no banco:', missingInDb.length)
console.log('No banco, ausentes na planilha:', extraInDb.length)
console.log('')

if (missingInDb.length) {
  console.log('--- Ausentes no Supabase (purge / não importados / só na fonte) ---')
  for (const c of missingInDb) console.log(c)
  console.log('')
}

if (extraInDb.length) {
  console.log('--- Só no Supabase (extra vs esta planilha) ---')
  for (const c of extraInDb) console.log(c)
}
