#!/usr/bin/env node
/**
 * Sincroniza população IBGE para municípios presentes em alwayson_insights_v_cidades.
 *
 * Variáveis: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (+ .env.local)
 *
 * Uso:
 *   node scripts/sync-ibge-populacao.mjs
 *   node scripts/sync-ibge-populacao.mjs --uf PB
 */

/* eslint-disable no-console */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { resolvePopulacaoDetalhada } from './lib/ibge-populacao.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

tryLoadDotenv()

function tryLoadDotenv() {
  for (const f of ['.env.local', '.env']) {
    const p = path.join(ROOT, f)
    if (!fs.existsSync(p)) continue
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      const t = line.trim()
      if (!t || t.startsWith('#')) continue
      const eq = t.indexOf('=')
      if (eq <= 0) continue
      const k = t.slice(0, eq).trim()
      let v = t.slice(eq + 1).trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1)
      }
      if (process.env[k] == null) process.env[k] = v
    }
  }
}

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(url, key)
const ufFilter = (() => {
  const i = process.argv.indexOf('--uf')
  return i >= 0 ? process.argv[i + 1]?.toUpperCase() : null
})()

async function main() {
  const { data: cidades, error } = await supabase
    .from('alwayson_insights_v_cidades')
    .select('cidade, estado')
  if (error) throw error

  let refs = (cidades ?? []).filter(
    (c) => c.cidade && c.estado && !String(c.cidade).startsWith('—')
  )
  if (ufFilter) {
    refs = refs.filter((c) => String(c.estado).toUpperCase().trim() === ufFilter)
  }

  console.log(`Resolvendo população IBGE para ${refs.length} cidades…`)

  const rows = await resolvePopulacaoDetalhada(refs)
  console.log(`Match IBGE: ${rows.length}/${refs.length} cidades`)

  if (rows.length === 0) {
    console.log('Nada a gravar.')
    return
  }

  const batchSize = 100
  let upserted = 0
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize)
    const { error: upErr } = await supabase
      .from('alwayson_ibge_municipio_populacao')
      .upsert(batch, { onConflict: 'cidade_norm,estado,ano_referencia' })
    if (upErr) throw upErr
    upserted += batch.length
  }

  console.log(`Concluído: ${upserted} registros upserted.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
