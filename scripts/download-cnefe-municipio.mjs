#!/usr/bin/env node
/**
 * Baixa CNEFE 2022 (IBGE) por município.
 *
 * Uso:
 *   node scripts/download-cnefe-municipio.mjs --piloto petrolina
 *   node scripts/download-cnefe-municipio.mjs --codigo-ibge 2611101 --uf PE --municipio PETROLINA
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'

const execFileAsync = promisify(execFile)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

const CNEFE_BASE =
  'https://ftp.ibge.gov.br/Cadastro_Nacional_de_Enderecos_para_Fins_Estatisticos/Censo_Demografico_2022/Arquivos_CNEFE/CSV/Municipio'

function parseArgs(argv) {
  const out = { outDir: path.join(ROOT, 'data', 'cnefe') }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--out-dir') out.outDir = path.resolve(argv[++i] ?? out.outDir)
    else if (a === '--codigo-ibge') out.codigoIbge = Number(argv[++i])
    else if (a === '--uf') out.uf = String(argv[++i] ?? '').toUpperCase()
    else if (a === '--municipio') out.municipio = String(argv[++i] ?? '').toUpperCase()
    else if (a === '--piloto') {
      const nome = String(argv[++i] ?? 'petrolina').toLowerCase()
      if (nome !== 'petrolina') throw new Error(`Piloto desconhecido: ${nome}`)
      out.codigoIbge = 2611101
      out.uf = 'PE'
      out.municipio = 'PETROLINA'
    }
  }
  if (!out.codigoIbge || !out.uf || !out.municipio) {
    throw new Error('Informe --piloto petrolina ou --codigo-ibge --uf --municipio')
  }
  return out
}

function ufFolder(uf) {
  const map = {
    RO: '11', AC: '12', AM: '13', RR: '14', PA: '15', AP: '16', TO: '17',
    MA: '21', PI: '22', CE: '23', RN: '24', PB: '25', PE: '26', AL: '27',
    SE: '28', BA: '29', MG: '31', ES: '32', RJ: '33', SP: '35', PR: '41',
    SC: '42', RS: '43', MS: '50', MT: '51', GO: '52', DF: '53',
  }
  const n = map[uf.toUpperCase()]
  if (!n) throw new Error(`UF desconhecida: ${uf}`)
  return `${n}_${uf.toUpperCase()}`
}

async function main() {
  const args = parseArgs(process.argv)
  fs.mkdirSync(args.outDir, { recursive: true })

  const slug = args.municipio.replace(/\s+/g, '_')
  const zipName = `${args.codigoIbge}_${slug}.zip`
  const folder = ufFolder(args.uf)
  const url = `${CNEFE_BASE}/${folder}/${zipName}`
  const zipPath = path.join(args.outDir, zipName)

  console.log(`[cnefe] GET ${url}`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`)
  await fs.promises.writeFile(zipPath, Buffer.from(await res.arrayBuffer()))
  console.log(`[cnefe] salvo ${zipPath} (${(fs.statSync(zipPath).size / 1e6).toFixed(1)} MB)`)

  const csvName = `${args.codigoIbge}_${slug}.csv`
  const csvPath = path.join(args.outDir, csvName)
  if (!fs.existsSync(csvPath)) {
    console.log(`[cnefe] unzip ${zipName}`)
    await execFileAsync('unzip', ['-o', zipPath, '-d', args.outDir])
  }
  console.log(`[cnefe] pronto: ${csvPath}`)
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
