#!/usr/bin/env node
/**
 * Baixa arquivos abertos CNPJ (Receita) e extrai em data/receita/.
 * Fonte: espelho dos dados abertos RF (mesmo layout oficial).
 *
 * Uso:
 *   node scripts/download-receita-estabelecimentos.mjs
 *   node scripts/download-receita-estabelecimentos.mjs --only empresas simples
 *   node scripts/download-receita-estabelecimentos.mjs --snapshot 2025-07-30
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

const snapshot = process.argv.includes('--snapshot')
  ? process.argv[process.argv.indexOf('--snapshot') + 1]
  : '2025-07-30'

const onlyIdx = process.argv.indexOf('--only')
const only =
  onlyIdx >= 0
    ? new Set(process.argv.slice(onlyIdx + 1).filter((a) => !a.startsWith('--')))
    : new Set(['estabele', 'empresas', 'simples', 'municipios'])

const BASE = `https://dados-abertos-rf-cnpj.casadosdados.com.br/arquivos/${snapshot}`
// ponytail: RECEITA_DATA_DIR (Railway volume) escreve direto na raiz, sem subpasta de snapshot — é o formato que receita-universo.mjs espera
const OUT_DIR = process.env.RECEITA_DATA_DIR || path.join(ROOT, 'data', 'receita', snapshot)

async function download(url, dest) {
  if (fs.existsSync(dest)) {
    const stat = fs.statSync(dest)
    if (stat.size > 0) {
      console.log(`[skip] ${path.basename(dest)} (${(stat.size / 1e6).toFixed(1)} MB)`)
      return
    }
  }
  console.log(`[get] ${path.basename(dest)}`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`)
  await pipeline(res.body, fs.createWriteStream(dest))
  const stat = fs.statSync(dest)
  console.log(`[ok] ${path.basename(dest)} (${(stat.size / 1e6).toFixed(1)} MB)`)
}

function extractedForZip(baseName, files) {
  const m = baseName.match(/^(Estabelecimentos|Empresas)(\d+)$/i)
  if (m) {
    const kind = m[1].toLowerCase().startsWith('estabele') ? 'ESTABELE' : 'EMPRE'
    const idx = m[2]
    return files.some(
      (f) => !f.endsWith('.zip') && f.toUpperCase().includes(`.Y${idx}.`) && f.toUpperCase().includes(kind)
    )
  }
  if (baseName.toLowerCase() === 'simples') {
    return files.some((f) => !f.endsWith('.zip') && /simples/i.test(f))
  }
  if (baseName.toLowerCase() === 'municipios') {
    return files.some((f) => !f.endsWith('.zip') && /\.munic/i.test(f))
  }
  return false
}

async function unzipIfNeeded(zipPath, outDir) {
  const base = path.basename(zipPath, '.zip')
  const entries = fs.readdirSync(outDir)
  if (extractedForZip(base, entries)) {
    console.log(`[skip unzip] ${path.basename(zipPath)}`)
    return
  }
  console.log(`[unzip] ${path.basename(zipPath)}`)
  await execFileAsync('unzip', ['-o', zipPath, '-d', outDir])
}

async function downloadSeries(prefix, count) {
  for (let i = 0; i < count; i++) {
    const name = `${prefix}${i}.zip`
    const zipPath = path.join(OUT_DIR, name)
    await download(`${BASE}/${name}`, zipPath)
    await unzipIfNeeded(zipPath, OUT_DIR)
  }
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  if (only.has('estabele')) await downloadSeries('Estabelecimentos', 10)
  if (only.has('empresas')) await downloadSeries('Empresas', 10)
  if (only.has('simples')) {
    const name = 'Simples.zip'
    const zipPath = path.join(OUT_DIR, name)
    await download(`${BASE}/${name}`, zipPath)
    await unzipIfNeeded(zipPath, OUT_DIR)
  }
  if (only.has('municipios')) {
    const name = 'Municipios.zip'
    const zipPath = path.join(OUT_DIR, name)
    await download(`${BASE}/${name}`, zipPath)
    await unzipIfNeeded(zipPath, OUT_DIR)
  }
  console.log(`\nPronto: ${OUT_DIR}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
