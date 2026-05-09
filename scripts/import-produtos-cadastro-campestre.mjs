#!/usr/bin/env node
/**
 * Carrega produtos oficiais a partir de docs/cadastrogeral_vinicolacampestre.xlsx (aba Produtos).
 * Apenas campos úteis à plataforma: código, nome, marca, categoria, detalhamento, status cadastro → ativo.
 * Ignora pesos, dimensões, pallet, imagens, tributos etc.
 *
 * Variável: DATABASE_URL — connection string Postgres do projeto Supabase canônico
 * (igual ao `scripts/apply-migrations.mjs`; session mode está ok).
 * O upsert atualiza apenas sku/descricao/categoria/marca/detalhamento_categoria/ativo.
 *
 * Uso:
 *   node scripts/import-produtos-cadastro-campestre.mjs
 *   node scripts/import-produtos-cadastro-campestre.mjs --file docs/outro.xlsx --dry-run
 *   node scripts/import-produtos-cadastro-campestre.mjs --sheet OutraAba
 */

/* eslint-disable no-console */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

import * as XLSX from 'xlsx'
import pg from 'pg'

const UPSERT_SQL = `
INSERT INTO alwayson_produtos (sku, descricao, categoria, marca, detalhamento_categoria, ativo)
VALUES ($1, $2, $3, $4, $5, $6)
ON CONFLICT (sku) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  categoria = EXCLUDED.categoria,
  marca = EXCLUDED.marca,
  detalhamento_categoria = EXCLUDED.detalhamento_categoria,
  ativo = EXCLUDED.ativo
`

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

const DEFAULT_FILE = path.join(ROOT, 'docs', 'cadastrogeral_vinicolacampestre.xlsx')
const DEFAULT_SHEET = 'Produtos'
tryLoadDotenv()

function tryLoadDotenv() {
  for (const f of ['.env.local', '.env']) {
    const p = path.join(ROOT, f)
    if (!fs.existsSync(p)) continue
    const text = fs.readFileSync(p, 'utf8')
    for (const line of text.split('\n')) {
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
}

function normalizeProductCode(v) {
  if (v === '' || v === null || v === undefined) return ''
  if (typeof v === 'string') {
    const t = v.trim()
    if (t === '') return ''
    if (t.includes('.')) return t
    if (/^\d{6}$/.test(t)) return `${t.slice(0, 2)}.${t.slice(2)}`
    return t
  }
  if (typeof v === 'number' && Number.isFinite(v)) {
    const n = Math.round(v)
    if (n < 100000 || n > 999999) return String(v)
    const s = String(n).padStart(6, '0')
    return `${s.slice(0, 2)}.${s.slice(2)}`
  }
  return String(v).trim()
}

function str(v) {
  if (v == null || v === '') return ''
  return String(v).trim()
}

function parseArgs(argv) {
  const out = {
    file: DEFAULT_FILE,
    sheet: DEFAULT_SHEET,
    dryRun: false,
  }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--dry-run') out.dryRun = true
    else if (a === '--file' && argv[i + 1]) out.file = path.resolve(argv[++i])
    else if (a === '--sheet' && argv[i + 1]) out.sheet = argv[++i]
  }
  return out
}

function readRows(buf, sheetName) {
  const wb = XLSX.read(buf, { type: 'buffer', cellDates: true })
  const name = wb.SheetNames.includes(sheetName)
    ? sheetName
    : wb.SheetNames.find((n) => n.trim() === sheetName.trim()) ?? wb.SheetNames[0]
  const ws = wb.Sheets[name]
  if (!ws) throw new Error(`Planilha não encontrada: ${sheetName}. Disponíveis: ${wb.SheetNames.join(', ')}`)

  /** @type {Record<string, unknown>[]} */
  const raw = XLSX.utils.sheet_to_json(ws, { defval: '', raw: true })
  return { sheetUsed: name, rows: raw }
}

function rowPayload(row) {
  const sku = normalizeProductCode(row['Código'])
  const nome = str(row['Nome'])
  const nomeSimp = str(row['Nome Simplificado'])
  const descricao = nome || nomeSimp || sku
  const marca = str(row['Marca']) || null
  const categoriaRaw = str(row['Categoria'])
  const detalheRaw = str(row['Detalhamento Categoria'])
  const status = str(row['Status Cadastro']).toLowerCase()

  if (!sku) return null

  const ativo = status === 'ativo'
  const categoria = categoriaRaw || null
  const detalhamento_categoria = detalheRaw || null

  return {
    sku,
    descricao,
    categoria,
    marca,
    detalhamento_categoria,
    ativo,
  }
}

async function main() {
  const { file, sheet: sheetRequested, dryRun } = parseArgs(process.argv)

  if (!fs.existsSync(file)) {
    console.error('Arquivo não encontrado:', file)
    process.exit(1)
  }

  const buf = fs.readFileSync(file)
  const { sheetUsed, rows } = readRows(buf, sheetRequested)
  console.log(`Arquivo: ${file}`)
  console.log(`Aba usada: ${sheetUsed}`)
  console.log(`Linhas de dados: ${rows.length}`)

  /** @type {Map<string, object>} */
  const bySku = new Map()
  let skipped = 0
  let dupes = 0

  for (const row of rows) {
    const p = rowPayload(row)
    if (!p) {
      skipped++
      continue
    }
    if (bySku.has(p.sku)) {
      dupes++
      console.warn('SKU duplicado na planilha (última linha prevalece):', p.sku)
    }
    bySku.set(p.sku, p)
  }

  const payloads = [...bySku.values()]

  if (payloads.length === 0) {
    console.error('Nenhuma linha válida para importar.')
    process.exit(1)
  }

  console.log(`Upsert planejado: ${payloads.length} SKUs (linhas sem código: ${skipped})`)

  if (dryRun) {
    console.log('[dry-run] amostra:', JSON.stringify(payloads.slice(0, 3), null, 2))
    return
  }

  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) {
    console.error(
      'Defina DATABASE_URL (connection string Postgres; ver .env.example e apply-migrations.mjs).'
    )
    process.exit(1)
  }

  const client = new pg.Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  })

  await client.connect()
  try {
    await client.query('BEGIN')
    for (let i = 0; i < payloads.length; i++) {
      const p = payloads[i]
      await client.query(UPSERT_SQL, [
        p.sku,
        p.descricao,
        p.categoria,
        p.marca,
        p.detalhamento_categoria,
        p.ativo,
      ])
      if (((i + 1) % 25 === 0) || i + 1 === payloads.length)
        console.log(`… ${i + 1} / ${payloads.length}`)
    }
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    console.error(err.message ?? err)
    if (String(err.message).includes('does not exist') || String(err.code) === '42703')
      console.error(
        '\nPossível causa: migrações 022 (marca/detalhe) ou 023 (remove preço) ainda não aplicadas no projeto.'
      )
    process.exit(1)
  } finally {
    await client.end()
  }

  console.log(
    'Concluído.',
    dupes ? ` (${dupes} linhas substituíram SKU repetido anterior na planilha)` : ''
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
