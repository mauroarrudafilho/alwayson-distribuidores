#!/usr/bin/env node
/**
 * Enriquece UF/cidade/endereço da carteira (`alwayson_clientes_distribuidor`) quando
 * ausentes: Insights primeiro, BrasilAPI em seguida.
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (+ .env.local).
 *
 * Uso:
 *   npm run clientes:enrich-geo
 *   npm run clientes:enrich-geo -- --limit 50
 *   npm run clientes:enrich-geo -- --distribuidor-id <uuid>
 *   npm run clientes:enrich-geo -- --dry-run
 */

/* eslint-disable no-console -- CLI */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createClient } from '@supabase/supabase-js'

import {
  applyClienteGeoPatches,
  clienteGeoPatchFromResolved,
  isCidadeVazia,
  normalizeCnpjDigits,
  resolveClienteCidadesBatch,
} from '../services/ingest-api/lib/resolve-cliente-cidade.mjs'

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
  let limit = 500
  let dryRun = false
  /** @type {string | null} */
  let distribuidorId = null
  let brasilDelayMs = 750

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    switch (a) {
      case '--limit':
        limit = Math.max(1, parseInt(String(argv[++i] ?? '500'), 10) || 500)
        break
      case '--distribuidor-id':
        distribuidorId = String(argv[++i] ?? '').trim() || null
        break
      case '--delay-ms':
        brasilDelayMs = Math.max(200, parseInt(String(argv[++i] ?? '750'), 10) || 750)
        break
      case '--dry-run':
        dryRun = true
        break
      case '--help':
      case '-h':
        console.log(`
Uso:
  npm run clientes:enrich-geo [-- --limit N] [-- --distribuidor-id UUID] [-- --dry-run]

Preenche cidade/UF/endereço fiscal via Insights ou BrasilAPI para clientes com geo vazia.
`)
        process.exit(0)
        break
      default:
        break
    }
  }
  return { limit, dryRun, distribuidorId, brasilDelayMs }
}

async function fetchPendentes(sb, { limit, distribuidorId }) {
  /** @type {Array<{ id: string, cnpj: string, distribuidor_id: string }>} */
  const out = []
  for (let from = 0; out.length < limit; from += 500) {
    let q = sb
      .from('alwayson_clientes_distribuidor')
      .select('id, cnpj, distribuidor_id, cidade, estado')
      .order('criado_em', { ascending: true })
      .range(from, from + 499)
    if (distribuidorId) q = q.eq('distribuidor_id', distribuidorId)

    const { data, error } = await q
    if (error) throw error
    const chunk = data ?? []
    if (!chunk.length) break

    for (const row of chunk) {
      if (out.length >= limit) break
      if (isCidadeVazia(row.cidade, row.estado)) {
        out.push({
          id: String(row.id),
          cnpj: String(row.cnpj),
          distribuidor_id: String(row.distribuidor_id),
        })
      }
    }
    if (chunk.length < 500) break
  }
  return out
}

async function main() {
  const { limit, dryRun, distribuidorId, brasilDelayMs } = parseArgs(process.argv)

  const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SUPABASE_URL || !SERVICE) {
    console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.')
    process.exit(1)
  }

  const sb = createClient(SUPABASE_URL.replace(/\/$/, ''), SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const pendentes = await fetchPendentes(sb, { limit, distribuidorId })
  if (!pendentes.length) {
    console.log('Nenhum cliente com UF/cidade pendente.')
    return
  }

  console.log(
    `Enriquecendo ${pendentes.length} cliente(s)` +
      (distribuidorId ? ` (distribuidor ${distribuidorId})` : '') +
      (dryRun ? ' [dry-run]' : '') +
      ` · delay BrasilAPI ${brasilDelayMs}ms`
  )

  const cnpjs = pendentes.map((p) => p.cnpj)
  const geoMap = await resolveClienteCidadesBatch(sb, cnpjs, {
    brasilDelayMs,
    onProgress: (cur, total, cnpj) => {
      process.stdout.write(`\r[${cur}/${total}] ${cnpj}   `)
    },
    onWarning: (msg) => console.warn(`\n${msg}`),
  })

  /** @type {Array<{ id: string } & Record<string, unknown>>} */
  const patches = []
  let insights = 0
  let brasil = 0
  let falhas = 0

  for (const row of pendentes) {
    const resolved = geoMap.get(normalizeCnpjDigits(row.cnpj))
    const patch = clienteGeoPatchFromResolved(resolved)
    if (!patch) {
      falhas++
      continue
    }
    if (resolved?.source === 'insights') insights++
    if (resolved?.source === 'brasilapi') brasil++
    patches.push({ id: row.id, ...patch })
  }

  console.log(
    `\nResolvíveis: ${patches.length} (Insights ${insights}, BrasilAPI ${brasil}, sem geo ${falhas})`
  )

  if (dryRun) {
    console.log('Dry-run — nenhuma escrita.')
    return
  }

  if (patches.length) {
    await applyClienteGeoPatches(sb, patches)
    console.log(`Atualizados ${patches.length} registro(s) em alwayson_clientes_distribuidor.`)
  }

  if (falhas) {
    console.log(`${falhas} CNPJ(s) permanecem sem geo (BrasilAPI/Insights indisponíveis).`)
  }
}

await main()
