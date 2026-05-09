#!/usr/bin/env node
/**
 * Processa fila de CNPJs na dimensão alwayson_insights_clientes com BrasilAPI (1 a 1).
 * Útil quando import deixou registros em pending ou após falhas (429, rede).
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (+ .env.local como nos outros scripts).
 *
 * Uso:
 *   node scripts/process-insights-clientes-pendentes.mjs --limit 80
 *   node scripts/process-insights-clientes-pendentes.mjs --limit 20 --retry-error
 *   node scripts/process-insights-clientes-pendentes.mjs --only 32267292001353
 *   node scripts/process-insights-clientes-pendentes.mjs --dry-run
 */

/* eslint-disable no-console -- CLI */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createClient } from '@supabase/supabase-js'

import { enrichCnpjGeo, normalizeCnpjDigits } from './lib/insights-cnpj-geo.mjs'
import {
  buildInsightsClienteUpsertPayload,
  CLIENTE_BRASIL_STATUS,
} from './lib/insights-cliente-dimension.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

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

function parseArgs(argv) {
  let limit = 50
  let dryRun = false
  let retryError = false
  /** @type {boolean} */
  let useNominatim = false
  /** @type {string[]} */
  const only = []
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    switch (a) {
      case '--limit':
        limit = Math.max(1, parseInt(String(argv[++i] ?? '50'), 10) || 50)
        break
      case '--dry-run':
        dryRun = true
        break
      case '--retry-error':
        retryError = true
        break
      case '--geo-nominatim':
        useNominatim = true
        break
      case '--only':
        {
          const v = argv[++i] ?? ''
          const d = normalizeCnpjDigits(v)
          if (d.length === 14) only.push(d)
          else console.warn('Ignorando --only inválido:', v)
        }
        break
      case '--help':
      case '-h':
        console.log(`
Uso:
  node scripts/process-insights-clientes-pendentes.mjs [--limit N] [--dry-run] [--retry-error] [--geo-nominatim]
  node scripts/process-insights-clientes-pendentes.mjs --only 12345678000199

Marcam-se clientes BrasilAPI em ordem FIFO (pending; com --retry-error inclui também error).
`)
        process.exit(0)
        break
      default:
        break
    }
  }
  return { limit, dryRun, retryError, useNominatim, only }
}

async function main() {
  const { limit, dryRun, retryError, useNominatim, only } = parseArgs(process.argv)

  const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SUPABASE_URL || !SERVICE) {
    console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.')
    process.exit(1)
  }

  const sb = createClient(SUPABASE_URL.replace(/\/$/, ''), SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  if (only.length) {
    console.log('Modo --only:', only.length, 'CNPJ(s)', dryRun ? '(dry-run)' : '')
    for (const cnpj of [...new Set(only)]) {
      const { data: row, error } = await sb.from('alwayson_insights_clientes').select('*').eq('cnpj_14', cnpj).maybeSingle()
      if (error) {
        console.error('Leitura cliente', cnpj, error.message)
        continue
      }
      if (!row) {
        console.warn('Cliente não existe na dimensão:', cnpj)
        continue
      }
      await processOne(sb, row, { dryRun, useNominatim, force: true })
    }
    console.log('Concluído.')
    return
  }

  let listQuery = sb
    .from('alwayson_insights_clientes')
    .select('cnpj_14')
    .order('criado_em', { ascending: true })
    .limit(limit)
  if (retryError) {
    listQuery = listQuery.in('brasil_enriquecimento_status', [
      CLIENTE_BRASIL_STATUS.PENDING,
      CLIENTE_BRASIL_STATUS.ERROR,
    ])
  } else listQuery = listQuery.eq('brasil_enriquecimento_status', CLIENTE_BRASIL_STATUS.PENDING)

  const { data: pendRows, error: pendErr } = await listQuery
  if (pendErr) {
    console.error('Lista pendentes falhou:', pendErr.message)
    process.exit(1)
  }
  const list = (pendRows ?? []).map((r) => String(r.cnpj_14)).filter((c) => c.length === 14)
  if (!list.length) {
    console.log('Nenhum registro em pending' + (retryError ? ' ou error' : '') + '.')
    return
  }

  console.log(
    `Processando ${list.length} cliente(s) (${retryError ? 'pending+error' : 'pending'}).` +
      (dryRun ? ' Dry-run.' : '') +
      (useNominatim ? ' Com Nominatim.' : '')
  )

  for (let i = 0; i < list.length; i++) {
    const cnpj = list[i]
    const { data: row, error } = await sb.from('alwayson_insights_clientes').select('*').eq('cnpj_14', cnpj).maybeSingle()
    if (error || !row) {
      console.warn('Pular (leitura)', cnpj, error?.message)
      continue
    }
    process.stdout.write(`\r[${i + 1}/${list.length}] ${cnpj} `)
    await processOne(sb, row, { dryRun, useNominatim })
  }
  console.log('\nConcluído.')
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} sb
 * @param {Record<string, unknown>} prev
 * @param {{ dryRun: boolean, useNominatim: boolean, force?: boolean }} opts
 */
async function processOne(sb, prev, opts) {
  const cnpj14 = String(prev.cnpj_14 ?? '')
  if (cnpj14.length !== 14) return

  const force = opts.force === true

  if (!opts.dryRun) {
    if (force) {
      const { error: eF } = await sb
        .from('alwayson_insights_clientes')
        .update({ brasil_enriquecimento_status: CLIENTE_BRASIL_STATUS.PROCESSING })
        .eq('cnpj_14', cnpj14)
      if (eF) {
        console.error('\nUpdate processing (--only) falhou', cnpj14, eF.message)
        return
      }
    } else {
      const { data: claimed, error: eClaim } = await sb
        .from('alwayson_insights_clientes')
        .update({ brasil_enriquecimento_status: CLIENTE_BRASIL_STATUS.PROCESSING })
        .eq('cnpj_14', cnpj14)
        .in('brasil_enriquecimento_status', [
          CLIENTE_BRASIL_STATUS.PENDING,
          CLIENTE_BRASIL_STATUS.ERROR,
        ])
        .select('cnpj_14')

      if (eClaim) {
        console.error('\nCAS processing falhou', cnpj14, eClaim.message)
        return
      }
      if (!claimed?.length) {
        console.warn('\nCNPJ já não estava pending/error (outro processo?):', cnpj14)
        return
      }
    }

    const { data: freshRow, error: eRead } = await sb
      .from('alwayson_insights_clientes')
      .select('*')
      .eq('cnpj_14', cnpj14)
      .maybeSingle()
    if (eRead || !freshRow) {
      console.error('\nReleitura após claim falhou', cnpj14)
      return
    }
    prev = freshRow
  }

  const geoR = await enrichCnpjGeo(cnpj14, {
    useNominatim: opts.useNominatim,
    brasilDelayMs: 750,
  })

  /** @type {Record<string, string | null>} */
  const header = {
    razao: prev.razao_social != null ? String(prev.razao_social) : null,
    nome_cliente: prev.nome_cliente != null ? String(prev.nome_cliente) : null,
  }

  const upsert = buildInsightsClienteUpsertPayload(cnpj14, header, prev, geoR, {
    geoImport: true,
    brasilAttemptedForCnpj: true,
  })

  if (opts.dryRun) {
    console.log('\nDry-run', cnpj14, geoR.ok ? 'OK' : geoR.reason)
    return
  }

  const { error: eUp } = await sb.from('alwayson_insights_clientes').upsert(upsert, {
    onConflict: 'cnpj_14',
  })
  if (eUp) console.error('\nUpsert falhou', cnpj14, eUp.message)
}

await main()
