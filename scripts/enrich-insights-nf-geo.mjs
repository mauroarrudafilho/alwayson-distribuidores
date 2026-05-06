#!/usr/bin/env node
/**
 * Enriquece alwayson_insights_clientes (dimensão por CNPJ) com cidade/UF (BrasilAPI) e lat/lng (Nominatim).
 * Efeito em todas as NFs daquele CNPJ, sem repetir dados por linha de nota.
 *
 * Variáveis: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (+ .env.local carregado como no import)
 *
 * Uso:
 *   node scripts/enrich-insights-nf-geo.mjs --upload-id <uuid>
 *   node scripts/enrich-insights-nf-geo.mjs --last-upload
 *   node scripts/enrich-insights-nf-geo.mjs --last-upload --no-nominatim
 *
 * Política Nominatim: ~1 req/s + User-Agent identificável.
 */

/* eslint-disable no-console -- CLI */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createClient } from '@supabase/supabase-js'

import { enrichCnpjGeo, normalizeCnpjDigits } from './lib/insights-cnpj-geo.mjs'

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
  let uploadId = ''
  let lastUpload = false
  let dryRun = false
  let noNominatim = false
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--upload-id') uploadId = argv[++i] ?? ''
    else if (a === '--last-upload') lastUpload = true
    else if (a === '--dry-run') dryRun = true
    else if (a === '--no-nominatim') noNominatim = true
    else if (a === '--help' || a === '-h') {
      console.log(`
Uso:
  node scripts/enrich-insights-nf-geo.mjs --upload-id <uuid>
  node scripts/enrich-insights-nf-geo.mjs --last-upload

Opções:
  --dry-run           Não atualiza o Supabase (só resumo)
  --no-nominatim      Só BrasilAPI (cidade/UF); pula Nominatim (bem mais rápido)

Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
`)
      process.exit(0)
    }
  }
  return { uploadId, lastUpload, dryRun, noNominatim }
}

async function aplicarCliente(sb, r, brOk, dryRun) {
  if (dryRun) return
  const nowIso = new Date().toISOString()
  const digits = normalizeCnpjDigits(r.cnpj)
  if (digits.length !== 14) return
  if (!brOk) {
    const { error: eU } = await sb
      .from('alwayson_insights_clientes')
      .update({
        brasil_api_ultima_tentativa_em: nowIso,
        brasil_api_ultimo_motivo: r._err != null ? String(r._err) : 'desconhecido',
      })
      .eq('cnpj_14', digits)
    if (eU) console.error('\nUpdate cliente (erro API) falhou', digits, eU.message)
    return
  }
  const patch = {
    cidade: r.cidade,
    estado: r.estado,
    lat: r.lat,
    lng: r.lng,
    geo_enriquecido_em: r.geo_ts,
    brasil_api_ultima_tentativa_em: nowIso,
    brasil_api_ultimo_motivo: null,
  }
  const { error: eU } = await sb.from('alwayson_insights_clientes').update(patch).eq('cnpj_14', digits)
  if (eU) console.error('\nUpdate cliente falhou', digits, eU.message)
}

async function main() {
  const { uploadId: idArg, lastUpload, dryRun, noNominatim } = parseArgs(process.argv)

  const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!SUPABASE_URL || !SERVICE) {
    console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.')
    process.exit(1)
  }

  const sb = createClient(SUPABASE_URL.replace(/\/$/, ''), SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  let uploadId = idArg
  if (lastUpload || !uploadId) {
    if (!lastUpload && !uploadId) {
      console.error('Informe --upload-id ou --last-upload')
      process.exit(1)
    }
    const { data: up, error } = await sb
      .from('alwayson_insights_uploads')
      .select('id')
      .order('criado_em', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error || !up?.id) {
      console.error('Não achei último upload:', error?.message)
      process.exit(1)
    }
    uploadId = up.id
  }

  console.log('Upload alvo:', uploadId, dryRun ? '(dry-run)' : '', noNominatim ? '(sem Nominatim)' : '')

  const { data: nfs, error: eNfs } = await sb
    .from('alwayson_insights_nf')
    .select('cnpj_cliente')
    .eq('upload_id', uploadId)

  if (eNfs || !nfs?.length) {
    console.error('Sem NFs neste upload:', eNfs?.message)
    process.exit(1)
  }

  const unique = [...new Set(nfs.map((r) => r.cnpj_cliente))]
  console.log('CNPJs únicos a enriquecer:', unique.length)

  /** @type {Array<{ cnpj: string, cidade: string|null, estado: string|null, lat: number|null, lng: number|null, geo_ts: string|null, _err?: string }>} */
  const results = []

  for (let i = 0; i < unique.length; i++) {
    const cnpj = unique[i]
    const digits = normalizeCnpjDigits(cnpj)
    process.stdout.write(`\r[${i + 1}/${unique.length}] ${cnpj} `)

    const r = await enrichCnpjGeo(digits, { useNominatim: !noNominatim })

    if (!r.ok) {
      results.push({
        cnpj,
        cidade: null,
        estado: null,
        lat: null,
        lng: null,
        geo_ts: null,
        _err: r.reason,
      })
      await aplicarCliente(sb, { cnpj, _err: r.reason }, false, dryRun)
      continue
    }

    const row = {
      cnpj,
      cidade: r.cidade,
      estado: r.estado,
      lat: r.lat,
      lng: r.lng,
      geo_ts: r.geoTs,
    }
    results.push(row)
    await aplicarCliente(sb, row, true, dryRun)
  }
  console.log('\n')

  const comCoord = results.filter((r) => r.lat != null).length
  const comCidade = results.filter((r) => r.cidade).length
  console.log(
    `Resumo API: ${comCidade} com município/UF (BrasilAPI), ${comCoord} com coordenadas (Nominatim)`
  )

  if (dryRun) {
    console.log('Dry-run: não atualizou Supabase.')
    process.exit(0)
  }

  console.log('Atualização incremental concluída para upload', uploadId)
}

await main()
