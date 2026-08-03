#!/usr/bin/env node
/**
 * Cruza CSV da Base dos Dados (RAIS estabelecimentos) × universo Petrolina.
 *
 * Gere o CSV no BigQuery com scripts/rais-bq-petrolina.sql (liste todos os CNPJs do piloto).
 *
 * Uso:
 *   node scripts/cruzar-rais-bq-petrolina.mjs --csv ./data/rais/2023/petrolina_estab_bq.csv
 */

import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'
import { createClient } from '@supabase/supabase-js'
import { loadDotenv } from '../services/pdv-pipeline/lib/dotenv.mjs'

loadDotenv()

const PETROLINA_IBGE = 2611101

function parseArgs() {
  let csv = ''
  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === '--csv') csv = process.argv[++i] ?? ''
  }
  if (!csv) throw new Error('Informe --csv com export BigQuery')
  return { csv }
}

function normalizaCnpj(raw) {
  return String(raw ?? '').replace(/\D/g, '').padStart(14, '0').slice(0, 14)
}

function parseCsvLine(line) {
  const out = []
  let cur = ''
  let q = false
  for (const ch of line) {
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

async function carregarUniverso(supabase) {
  const rows = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('alwayson_pdv_universo')
      .select('cnpj, nome_fantasia, razao_social, cnae_principal')
      .eq('codigo_ibge', PETROLINA_IBGE)
      .range(from, from + 999)
    if (error) throw error
    if (!data?.length) break
    rows.push(...data)
    if (data.length < 1000) break
  }
  return rows
}

async function lerRaisCsv(path) {
  const rl = createInterface({
    input: createReadStream(path, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  })
  let header = null
  const map = new Map()
  for await (const line of rl) {
    if (!line.trim()) continue
    const cols = parseCsvLine(line)
    if (!header) {
      header = cols.map((h) => h.toLowerCase())
      continue
    }
    const row = Object.fromEntries(header.map((h, i) => [h, cols[i]]))
    const cnpj = normalizaCnpj(row.cnpj ?? row.cnpj_cei)
    if (cnpj.length !== 14) continue
    map.set(cnpj, {
      vinculos_ativos: Number(row.quantidade_vinculos_ativos ?? row.vinculos_ativos) || 0,
      tamanho: row.tamanho_estabelecimento ?? null,
    })
  }
  return map
}

async function main() {
  const { csv } = parseArgs()
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
  const [universo, rais] = await Promise.all([carregarUniverso(supabase), lerRaisCsv(csv)])

  let matched = 0
  let vinculos = 0
  const amostra = []

  for (const u of universo) {
    const r = rais.get(u.cnpj)
    if (!r) continue
    matched++
    vinculos += r.vinculos_ativos
    if (amostra.length < 15) {
      amostra.push({
        cnpj: u.cnpj,
        nome: u.nome_fantasia || u.razao_social,
        vinculos_ativos: r.vinculos_ativos,
        tamanho: r.tamanho,
      })
    }
  }

  console.log(
    JSON.stringify(
      {
        universo: universo.length,
        rais_linhas: rais.size,
        matched_cnpj: matched,
        pct_match: Number(((matched / universo.length) * 100).toFixed(1)),
        vinculos_ativos_total: vinculos,
        amostra,
        nota: 'Fonte: basedosdados.br_me_rais.microdados_estabelecimentos',
      },
      null,
      2
    )
  )
}

main().catch((err) => {
  console.error('[rais-bq] falha:', err.message)
  process.exit(1)
})
