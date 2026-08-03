#!/usr/bin/env node
/**
 * Baixa Estabelecimentos0-9.zip (snapshot Receita) e extrai em data/receita/.
 * Fonte: espelho dos dados abertos RF (mesmo layout oficial).
 *
 * Uso: node scripts/download-receita-estabelecimentos.mjs [--snapshot 2025-07-30]
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

const BASE = `https://dados-abertos-rf-cnpj.casadosdados.com.br/arquivos/${snapshot}`
const OUT_DIR = path.join(ROOT, 'data', 'receita', snapshot)

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

async function unzip(zipPath, outDir) {
  const base = path.basename(zipPath, '.zip')
  const csvPath = path.join(outDir, `${base}.csv`)
  if (fs.existsSync(csvPath)) {
    console.log(`[skip unzip] ${base}.csv`)
    return
  }
  console.log(`[unzip] ${path.basename(zipPath)}`)
  await execFileAsync('unzip', ['-o', zipPath, '-d', outDir])
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  for (let i = 0; i <= 9; i++) {
    const name = `Estabelecimentos${i}.zip`
    const zipPath = path.join(OUT_DIR, name)
    await download(`${BASE}/${name}`, zipPath)
    await unzip(zipPath, OUT_DIR)
  }
  console.log(`\nPronto: ${OUT_DIR}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
