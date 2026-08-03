#!/usr/bin/env node
/**
 * Valida RAIS × universo PDV (piloto Petrolina).
 *
 * RAIS 2023 pública (ESTAB e VINC) é anonimizada — **sem CNPJ**.
 * Cruzamento por CNPJ exige microdados identificados (acesso restrito) ou Base dos Dados.
 *
 * Este script agrega RAIS_ESTAB_PUB por município (IBGE 6 dígitos = 261110) e compara
 * distribuição CNAE / vínculos ativos com alwayson_pdv_universo.
 *
 * Uso:
 *   node scripts/validar-rais-petrolina.mjs
 *   node scripts/validar-rais-petrolina.mjs --skip-download
 */

import { spawnSync } from 'node:child_process'
import { createReadStream, createWriteStream, existsSync, mkdirSync, statSync } from 'node:fs'
import { createInterface } from 'node:readline'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { loadDotenv } from '../services/pdv-pipeline/lib/dotenv.mjs'

loadDotenv()

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const PETROLINA_IBGE = 2611101
/** RAIS usa código IBGE com 6 dígitos (sem dígito verificador do município). */
const PETROLINA_RAIS_MUN = String(PETROLINA_IBGE).slice(0, 6)

const ESTAB_ARCHIVE = 'RAIS_ESTAB_PUB.7z'
const ESTAB_REMOTE = '/pdet/microdados/RAIS/2023/RAIS_ESTAB_PUB.7z'
const ESTAB_MIN_BYTES = 100 * 1024 * 1024

function parseArgs() {
  const out = { ano: 2023, skipDownload: false }
  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === '--ano') out.ano = Number(process.argv[++i])
    else if (process.argv[i] === '--skip-download') out.skipDownload = true
  }
  return out
}

function readReply(ctrl) {
  return new Promise((resolve, reject) => {
    let buf = ''
    const onData = (d) => {
      buf += d.toString()
      const lines = buf.split(/\r?\n/).filter(Boolean)
      const last = lines[lines.length - 1]
      if (/^\d{3} /.test(last)) {
        ctrl.removeListener('data', onData)
        const code = Number(last.slice(0, 3))
        if (code >= 400) reject(new Error(buf.trim()))
        else resolve(buf.trim())
      }
    }
    ctrl.on('data', onData)
    ctrl.on('error', reject)
  })
}

async function ftpCmd(ctrl, c) {
  if (c) ctrl.write(`${c}\r\n`)
  return readReply(ctrl)
}

async function ftpDownload(host, remotePath, localPath, expectedBytes) {
  const ctrl = net.createConnection(21, host)
  await new Promise((r, j) => {
    ctrl.once('connect', r)
    ctrl.once('error', j)
  })
  await readReply(ctrl)
  await ftpCmd(ctrl, 'USER anonymous')
  await ftpCmd(ctrl, 'PASS anonymous@')
  await ftpCmd(ctrl, 'TYPE I')
  const pasv = await ftpCmd(ctrl, 'PASV')
  const m = pasv.match(/\(([^)]+)\)/)
  if (!m) throw new Error(`PASV inválido: ${pasv}`)
  const nums = m[1].split(',').map(Number)
  const dataHost = nums.slice(0, 4).join('.')
  const dataPort = nums[4] * 256 + nums[5]
  const data = net.createConnection(dataPort, dataHost)
  const ws = createWriteStream(localPath)
  let bytes = 0
  let lastLog = Date.now()
  data.on('data', (chunk) => {
    bytes += chunk.length
    const now = Date.now()
    if (now - lastLog >= 3000) {
      const mb = (bytes / 1e6).toFixed(1)
      const pct =
        expectedBytes > 0 ? ` (${Math.min(100, ((bytes / expectedBytes) * 100).toFixed(0))}%)` : ''
      process.stdout.write(`\r[rais] download: ${mb} MB${pct}   `)
      lastLog = now
    }
  })
  data.pipe(ws)
  const retrPromise = ftpCmd(ctrl, `RETR ${remotePath}`)
  await new Promise((res, rej) => {
    ws.on('finish', res)
    ws.on('error', rej)
    data.on('error', rej)
  })
  process.stdout.write(`\r[rais] download: ${(bytes / 1e6).toFixed(1)} MB (100%)\n`)
  await retrPromise
  await ftpCmd(ctrl, 'QUIT')
  ctrl.end()
}

function extract7z(archive, outDir) {
  const r = spawnSync('7z', ['x', archive, `-o${outDir}`, '-y'], { encoding: 'utf8' })
  if (r.status !== 0) throw new Error(r.stderr || r.stdout || '7z falhou')
}

function parseCsvLine(line) {
  const out = []
  let cur = ''
  let q = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      q = !q
      continue
    }
    if (ch === ',' && !q) {
      out.push(cur.trim())
      cur = ''
      continue
    }
    cur += ch
  }
  out.push(cur.trim())
  return out
}

function normalizaCnae(raw) {
  const d = String(raw ?? '').replace(/\D/g, '')
  if (!d) return null
  return d.length >= 7 ? d.slice(0, 7) : d.padStart(7, '0')
}

function pickEstabColumns(headerCols) {
  const lower = headerCols.map((h) => h.toLowerCase())
  const idx = (pred) => lower.findIndex(pred)
  return {
    munIdx: idx((h) => h.includes('município') && h.includes('código')),
    cnaeIdx: idx((h) => h.includes('cnae 2.0 subclasse')),
    vincAtivosIdx: idx((h) => h.includes('vínculos ativos') || h.includes('vinculos ativos')),
    vincCltIdx: idx((h) => h.includes('vínculos clt') || h.includes('vinculos clt')),
    atividadeIdx: idx((h) => h.includes('atividade ano')),
    negativaIdx: idx((h) => h.includes('rais negativa')),
  }
}

async function carregarUniversoPetrolina(supabase) {
  const rows = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('alwayson_pdv_universo')
      .select('cnpj, cnae_principal, porte, capital_social, situacao_cadastral')
      .eq('codigo_ibge', PETROLINA_IBGE)
      .range(from, from + 999)
    if (error) throw error
    if (!data?.length) break
    rows.push(...data)
    if (data.length < 1000) break
  }
  return rows
}

function agregarPdvPorCnae(universo) {
  const byCnae = new Map()
  for (const u of universo) {
    const cnae = normalizaCnae(u.cnae_principal) ?? 'desconhecido'
    byCnae.set(cnae, (byCnae.get(cnae) ?? 0) + 1)
  }
  return byCnae
}

async function agregarEstabPetrolina(txtPath) {
  const rl = createInterface({
    input: createReadStream(txtPath, { encoding: 'latin1' }),
    crlfDelay: Infinity,
  })

  let cols = null
  let linha = 0
  let estabPetrolina = 0
  let vinculosAtivos = 0
  let vinculosClt = 0
  let raisNegativa = 0
  const byCnae = new Map()

  for await (const line of rl) {
    linha++
    if (!line.trim()) continue

    if (!cols) {
      const headerCols = parseCsvLine(line)
      cols = pickEstabColumns(headerCols)
      if (cols.munIdx < 0) {
        throw new Error(`Coluna município não encontrada. Header: ${line.slice(0, 400)}`)
      }
      console.log(
        `[rais] layout estab: mun=${cols.munIdx} cnae=${cols.cnaeIdx} vinc_ativos=${cols.vincAtivosIdx}`
      )
      continue
    }

    const parts = parseCsvLine(line)
    const mun = String(parts[cols.munIdx] ?? '').replace(/\D/g, '').slice(0, 6)
    if (mun !== PETROLINA_RAIS_MUN) continue

    estabPetrolina++
    const vAtivos = cols.vincAtivosIdx >= 0 ? Number(parts[cols.vincAtivosIdx]) || 0 : 0
    const vClt = cols.vincCltIdx >= 0 ? Number(parts[cols.vincCltIdx]) || 0 : 0
    vinculosAtivos += vAtivos
    vinculosClt += vClt

    if (cols.negativaIdx >= 0 && String(parts[cols.negativaIdx]).trim() === '1') {
      raisNegativa++
    }

    const cnae = normalizaCnae(cols.cnaeIdx >= 0 ? parts[cols.cnaeIdx] : null) ?? 'desconhecido'
    const prev = byCnae.get(cnae) ?? { estab: 0, vinculos_ativos: 0 }
    prev.estab++
    prev.vinculos_ativos += vAtivos
    byCnae.set(cnae, prev)

    if (linha % 2_000_000 === 0) {
      process.stdout.write(
        `\r[rais] scan estab: ${(linha / 1e6).toFixed(1)}M linhas · ${estabPetrolina} em Petrolina   `
      )
    }
  }
  process.stdout.write('\n')

  return {
    linhas_lidas: linha,
    estabelecimentos: estabPetrolina,
    vinculos_ativos_total: vinculosAtivos,
    vinculos_clt_total: vinculosClt,
    rais_negativa: raisNegativa,
    by_cnae: Object.fromEntries(byCnae),
  }
}

function compararCnae(pdvByCnae, raisByCnae) {
  const cnaes = new Set([...pdvByCnae.keys(), ...Object.keys(raisByCnae)])
  const rows = [...cnaes].map((cnae) => ({
    cnae,
    pdv_universo: pdvByCnae.get(cnae) ?? 0,
    rais_estab: raisByCnae[cnae]?.estab ?? 0,
    rais_vinculos_ativos: raisByCnae[cnae]?.vinculos_ativos ?? 0,
  }))
  rows.sort((a, b) => b.pdv_universo - a.pdv_universo || b.rais_estab - a.rais_estab)
  return rows.slice(0, 25)
}

function findDataFile(dir) {
  return spawnSync('find', [dir, '-type', 'f'], { encoding: 'utf8' })
    .stdout.split('\n')
    .find((f) => /\.(txt|comt)$/i.test(f ?? ''))
}

async function main() {
  const args = parseArgs()
  const raisDir = path.join(ROOT, 'data', 'rais', String(args.ano))
  mkdirSync(raisDir, { recursive: true })
  const archive = path.join(raisDir, ESTAB_ARCHIVE)
  const extractDir = path.join(raisDir, 'estab_extracted')

  if (!args.skipDownload) {
    if (!existsSync(archive) || statSync(archive).size < ESTAB_MIN_BYTES) {
      console.log(`[rais] baixando ${ESTAB_REMOTE} (~127 MB) …`)
      await ftpDownload('ftp.mtps.gov.br', ESTAB_REMOTE, archive, ESTAB_MIN_BYTES)
    }
    console.log(`[rais] arquivo ${(statSync(archive).size / 1e6).toFixed(1)} MB`)
  } else if (!existsSync(archive)) {
    // fallback: arquivo já extraído em data/rais/2023/extracted/
    const legacy = path.join(raisDir, 'extracted', 'RAIS_ESTAB_PUB.COMT')
    if (!existsSync(legacy)) {
      throw new Error(`Arquivo ${ESTAB_ARCHIVE} não encontrado. Rode sem --skip-download.`)
    }
  }

  mkdirSync(extractDir, { recursive: true })
  let txtPath = findDataFile(extractDir)

  if (!txtPath) {
    const legacy = path.join(raisDir, 'extracted', 'RAIS_ESTAB_PUB.COMT')
    if (existsSync(legacy)) {
      txtPath = legacy
      console.log('[rais] usando extração existente em extracted/')
    }
  }

  if (!txtPath && existsSync(archive)) {
    console.log('[rais] extraindo RAIS_ESTAB_PUB …')
    extract7z(archive, extractDir)
    txtPath = findDataFile(extractDir)
  }

  if (!txtPath) throw new Error('Arquivo RAIS_ESTAB_PUB não encontrado após extração')

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
  const universo = await carregarUniversoPetrolina(supabase)
  console.log(`[rais] universo Petrolina: ${universo.length} CNPJs (IBGE ${PETROLINA_IBGE})`)

  const rais = await agregarEstabPetrolina(txtPath)
  const pdvByCnae = agregarPdvPorCnae(universo)
  const comparacao = compararCnae(pdvByCnae, rais.by_cnae)

  const resultado = {
    ano: args.ano,
    municipio_ibge: PETROLINA_IBGE,
    municipio_rais_6dig: PETROLINA_RAIS_MUN,
    arquivo: path.basename(txtPath),
    modo: 'agregado_municipio',
    pdv_universo_total: universo.length,
    rais_estabelecimentos: rais.estabelecimentos,
    rais_vinculos_ativos: rais.vinculos_ativos_total,
    rais_vinculos_clt: rais.vinculos_clt_total,
    rais_negativa: rais.rais_negativa,
    razao_pdv_por_estab_rais: rais.estabelecimentos
      ? Number((universo.length / rais.estabelecimentos).toFixed(2))
      : null,
    top_cnae_comparacao: comparacao,
    nota:
      'RAIS 2023 pública não traz CNPJ (nem em ESTAB nem em VINC). Validação municipal agregada; cruzamento por CNPJ exige microdados identificados ou Base dos Dados.',
  }

  console.log(JSON.stringify(resultado, null, 2))
}

main().catch((err) => {
  console.error('[rais] falha:', err.message)
  process.exit(1)
})
