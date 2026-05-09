#!/usr/bin/env node
/**
 * Remove lotes em alwayson_insights_uploads pelo nome do arquivo gravado na importação.
 * CASCADE remove alwayson_insights_nf e alwayson_insights_nf_itens desses uploads.
 *
 * Env: SUPABASE_URL ou VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Uso:
 *   node scripts/delete-insights-upload-by-arquivo.mjs --arquivo nome.xlsx --dry-run
 *   node scripts/delete-insights-upload-by-arquivo.mjs --arquivo nome.xlsx --yes
 */

/* eslint-disable no-console -- CLI */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createClient } from '@supabase/supabase-js'

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
  let arquivo = ''
  let dryRun = false
  let yes = false

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--arquivo') arquivo = argv[++i] ?? ''
    else if (a === '--dry-run') dryRun = true
    else if (a === '--yes') yes = true
    else if (a === '--help' || a === '-h') {
      console.log(`
Remove uploads Insights em que arquivo_nome = basename informado.

Uso:
  node scripts/delete-insights-upload-by-arquivo.mjs --arquivo "GA_VGF_...cod_emp-15.xlsx" [--dry-run] [--yes]

Passar caminho completo ou só o nome: o match é sempre pelo basename.
`)
      process.exit(0)
    }
  }

  let arquivoNome = arquivo.trim()
  if (arquivoNome.includes('/') || arquivoNome.includes('\\')) arquivoNome = path.basename(arquivoNome)

  return { arquivoNome, dryRun, yes }
}

async function main() {
  const { arquivoNome, dryRun, yes } = parseArgs(process.argv)

  if (!arquivoNome) {
    console.error('Informe --arquivo <nome ou caminho Do .xlsx>. Use --help.')
    process.exit(1)
  }

  const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!SUPABASE_URL || !SERVICE) {
    console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (ou .env.local).')
    process.exit(1)
  }

  if (!dryRun && !yes) {
    console.error('Acrescente --yes para apagar ou --dry-run para só listar.')
    process.exit(1)
  }

  const sb = createClient(SUPABASE_URL.replace(/\/$/, ''), SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: uploads, error } = await sb
    .from('alwayson_insights_uploads')
    .select('id, nome, arquivo_nome, status, criado_em, total_nfs')
    .eq('arquivo_nome', arquivoNome)
    .order('criado_em', { ascending: false })

  if (error) {
    console.error('Supabase:', error.message)
    process.exit(1)
  }

  if (!uploads?.length) {
    console.log('Nenhum upload com arquivo_nome =', JSON.stringify(arquivoNome))
    process.exit(0)
  }

  console.log(`Encontrado(s) ${uploads.length} upload(s) com arquivo_nome = ${JSON.stringify(arquivoNome)}:\n`)
  for (const u of uploads) {
    console.log(
      `  id=${u.id} | status=${u.status} | total_nfs=${u.total_nfs ?? '—'} | criado=${u.criado_em} | nome=${u.nome}`
    )
  }

  if (dryRun) {
    console.log('\nDry-run — nada foi apagado.')
    process.exit(0)
  }

  const ids = uploads.map((u) => u.id)
  const { error: delErr } = await sb.from('alwayson_insights_uploads').delete().in('id', ids)

  if (delErr) {
    console.error('Falha ao apagar:', delErr.message)
    process.exit(1)
  }

  console.log(`\nRemovido(s) ${ids.length} registro(s) em alwayson_insights_uploads (NFs e itens em CASCADE).`)
}

await main()
