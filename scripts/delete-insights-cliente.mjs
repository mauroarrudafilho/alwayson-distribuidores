#!/usr/bin/env node
/**
 * Remove sempreon_insights_clientes pelo CNPJ + todas as NF e itens ligados (ON DELETE CASCADE).
 * Depois chama insights_reconcile_upload_totals para atualizar total_nfs / total_itens dos lotes tocados.
 * Usa SUPABASE_SERVICE_ROLE_KEY (mesmo fluxo que import).
 *
 * Uso:
 *   node scripts/delete-insights-cliente.mjs --cnpj 00006477513307 --yes
 *   node scripts/delete-insights-cliente.mjs --cnpj 00006477513307 --dry-run
 */

/* eslint-disable no-console -- CLI */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createClient } from '@supabase/supabase-js'

import { normalizeCnpjDigits } from './lib/insights-cnpj-geo.mjs'

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
  let cnpj = ''
  let yes = false
  let dryRun = false
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--cnpj') cnpj = argv[++i] ?? ''
    else if (a === '--yes') yes = true
    else if (a === '--dry-run') dryRun = true
    else if (a === '--help' || a === '-h') {
      console.log(`
Uso:
  node scripts/delete-insights-cliente.mjs --cnpj <14 dígitos> [--yes] [--dry-run]

Env: SUPABASE_URL ou VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
`)
      process.exit(0)
    }
  }
  return { cnpj, yes, dryRun }
}

async function main() {
  const { cnpj: raw, yes, dryRun } = parseArgs(process.argv)

  const digits = normalizeCnpjDigits(raw)
  if (digits.length !== 14) {
    console.error('Informe um CNPJ válido (--cnpj) com até 14 dígitos.')
    process.exit(1)
  }

  const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!SUPABASE_URL || !SERVICE) {
    console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const sb = createClient(SUPABASE_URL.replace(/\/$/, ''), SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { count: nfsAntes } = await sb
    .from('alwayson_insights_nf')
    .select('id', { count: 'exact', head: true })
    .eq('cnpj_cliente', digits)

  const { data: nfRows } = await sb
    .from('alwayson_insights_nf')
    .select('upload_id')
    .eq('cnpj_cliente', digits)

  const uploadIds = [...new Set((nfRows ?? []).map((r) => r.upload_id).filter(Boolean))]

  console.log(`CNPJ: ${digits}`)
  console.log(`NFs atualmente ligadas (aprox): ${nfsAntes ?? '?'}`)

  if (dryRun) {
    console.log('Dry-run: não alterou dados.')
    process.exit(0)
  }

  if (!yes) {
    console.error('Adicione --yes para confirmar exclusão irreversível (cliente + NFs + itens).')
    process.exit(1)
  }

  const { error: eDel } = await sb.from('alwayson_insights_clientes').delete().eq('cnpj_14', digits)

  if (eDel) {
    console.error('Falha ao apagar:', eDel.message)
    process.exit(1)
  }

  console.log('Removido alwayson_insights_clientes:', digits, '(CASCADE deve ter apagado NFs/itens)')

  if (uploadIds.length === 0) {
    process.exit(0)
  }

  const { error: eRec } = await sb.rpc('insights_reconcile_upload_totals', {
    p_upload_ids: uploadIds,
  })
  if (eRec) {
    console.error(
      'Aviso: exclusão ok, mas falha ao recalcular alwayson_insights_uploads (aplique migration 017):',
      eRec.message
    )
    process.exit(1)
  }
  console.log(`Totais atualizados em ${uploadIds.length} lote(s) de upload.`)
}

await main()
