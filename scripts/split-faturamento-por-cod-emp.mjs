#!/usr/bin/env node
/**
 * Divide o arquivo histórico de faturamento (template de vendas) em um XLSX por cod_emp.
 *
 * Uso:
 *   node scripts/split-faturamento-por-cod-emp.mjs
 *   node scripts/split-faturamento-por-cod-emp.mjs --input caminho/fonte.xlsx --out docs/outro-dir
 */

import * as XLSX from 'xlsx'
import { mkdirSync, existsSync, readFileSync } from 'fs'
import { dirname, join, basename } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

function parseArgs() {
  const args = process.argv.slice(2)
  let input = join(
    __dirname,
    '..',
    'docs',
    'GA_VGF_FATURAMENTOGLOBAL (GRUPOARRUDAPRD)_GA_VGF_FATURAMENTOGLOBAL_REV.xlsx'
  )
  let outDir = join(__dirname, '..', 'docs', 'faturamento-chunks-por-cod-emp')
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--input' && args[i + 1]) {
      input = args[++i]
    }
    if (args[i] === '--out' && args[i + 1]) {
      outDir = args[++i]
    }
  }
  return { input, outDir }
}

const { input, outDir } = parseArgs()

if (!existsSync(input)) {
  console.error('Arquivo não encontrado:', input)
  process.exit(1)
}

const wb = XLSX.read(readFileSync(input), { type: 'buffer' })
const sheetName = wb.SheetNames[0]
const ws = wb.Sheets[sheetName]
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
const header = rows[0]
const idxCodEmp = header.indexOf('cod_emp')
if (idxCodEmp < 0) {
  console.error('Coluna "cod_emp" não encontrada no cabeçalho.')
  process.exit(1)
}

const groups = new Map()
for (let r = 1; r < rows.length; r++) {
  const row = rows[r]
  const raw = row[idxCodEmp]
  const key = raw === '' || raw === null || raw === undefined ? '_sem_cod_emp' : String(raw).trim()
  if (!groups.has(key)) groups.set(key, [])
  groups.get(key).push(row)
}

mkdirSync(outDir, { recursive: true })

const base = basename(input, '.xlsx').replace(/[^\w.-]+/g, '_')
const summary = []

for (const [codEmp, body] of [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))) {
  const safe = codEmp.replace(/[^\w.-]+/g, '_')
  const fileName = `${base}_cod_emp-${safe}.xlsx`
  const outPath = join(outDir, fileName)

  const aoa = [header, ...body]
  const nws = XLSX.utils.aoa_to_sheet(aoa)
  const nwb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(nwb, nws, sheetName.slice(0, 31))

  XLSX.writeFile(nwb, outPath)
  summary.push({ cod_emp: codEmp, linhas: body.length, arquivo: fileName })
}

console.log('Gerados', summary.length, 'arquivos em', outDir)
console.table(summary)
console.log('Total de linhas (dados):', rows.length - 1)
