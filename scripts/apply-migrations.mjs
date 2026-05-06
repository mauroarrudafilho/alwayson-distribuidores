#!/usr/bin/env node
/**
 * Aplica migrations SQL diretamente no Postgres do projeto Supabase canônico.
 *
 * Pré-requisitos:
 *   .env.local com DATABASE_URL apontando para o projeto canônico (osukbalwykbqvoumddxz).
 *   Pega a connection string em: Supabase dashboard → Project Settings → Database
 *   → Connection string → URI (modo "Session" ou "Transaction"; Session é mais seguro p/ DDL).
 *
 * Uso:
 *   node scripts/apply-migrations.mjs --list                # mostra arquivos disponíveis
 *   node scripts/apply-migrations.mjs --apply 016 017       # aplica esses números (em ordem)
 *   node scripts/apply-migrations.mjs --from 010            # aplica >= 010 (em ordem)
 *   node scripts/apply-migrations.mjs --files 016_*.sql 017_*.sql  # caminhos relativos a docs/migrations
 *   node scripts/apply-migrations.mjs --dry-run --apply 016 017
 *
 * Cada arquivo roda dentro de uma transação. Falha → rollback dele e aborta a fila.
 */

/* eslint-disable no-console -- CLI */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

import pg from 'pg'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const MIGRATIONS_DIR = path.join(ROOT, 'docs', 'migrations')

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

function listMigrations() {
  const entries = fs.readdirSync(MIGRATIONS_DIR)
  return entries
    .filter((f) => /^\d{3}_.+\.sql$/.test(f))
    .sort()
    .map((file) => ({
      file,
      number: file.slice(0, 3),
      path: path.join(MIGRATIONS_DIR, file),
    }))
}

function parseArgs(argv) {
  const out = {
    list: false,
    dryRun: false,
    apply: [],
    files: [],
    from: null,
  }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--list') out.list = true
    else if (a === '--dry-run') out.dryRun = true
    else if (a === '--apply') {
      while (i + 1 < argv.length && /^\d{1,3}$/.test(argv[i + 1])) {
        out.apply.push(argv[++i].padStart(3, '0'))
      }
    } else if (a === '--from') {
      out.from = (argv[++i] ?? '').padStart(3, '0')
    } else if (a === '--files') {
      while (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
        out.files.push(argv[++i])
      }
    } else if (a === '--help' || a === '-h') {
      console.log(
        'Uso: --list | --apply 016 017 | --from 010 | --files 016_x.sql 017_y.sql [--dry-run]'
      )
      process.exit(0)
    }
  }
  return out
}

function pickQueue(opts) {
  const all = listMigrations()
  if (opts.apply.length) {
    return opts.apply
      .map((n) => all.find((m) => m.number === n))
      .filter((m) => {
        if (!m) console.warn('Aviso: número de migration não encontrado nesta lista')
        return Boolean(m)
      })
  }
  if (opts.files.length) {
    return opts.files
      .map((rel) => {
        const file = path.basename(rel)
        const found = all.find((m) => m.file === file)
        if (!found) {
          const fullPath = path.isAbsolute(rel) ? rel : path.join(MIGRATIONS_DIR, file)
          if (!fs.existsSync(fullPath)) {
            console.warn(`Aviso: arquivo não encontrado: ${rel}`)
            return null
          }
          return { file, number: file.slice(0, 3), path: fullPath }
        }
        return found
      })
      .filter(Boolean)
  }
  if (opts.from) {
    return all.filter((m) => m.number >= opts.from)
  }
  return []
}

async function applyOne(client, m, dryRun) {
  const sql = fs.readFileSync(m.path, 'utf8')
  console.log(`\n──── ${m.file} (${sql.length.toLocaleString()} bytes) ────`)
  if (dryRun) {
    console.log('Dry-run: pulando execução.')
    return
  }
  try {
    await client.query('BEGIN')
    await client.query(sql)
    await client.query('COMMIT')
    console.log(`Aplicada: ${m.file}`)
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    console.error(`Falha em ${m.file}:`, err.message)
    throw err
  }
}

async function main() {
  const opts = parseArgs(process.argv)

  if (opts.list) {
    console.log('Migrations disponíveis:')
    for (const m of listMigrations()) console.log(' -', m.file)
    process.exit(0)
  }

  const queue = pickQueue(opts)
  if (!queue.length) {
    console.error('Nada para aplicar. Use --list, --apply, --from ou --files.')
    process.exit(1)
  }

  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) {
    console.error(
      'DATABASE_URL ausente. Cole a connection string do Supabase canônico em .env.local.'
    )
    process.exit(1)
  }

  console.log(`Migrations na fila (${queue.length}):`)
  for (const m of queue) console.log('  ·', m.file)

  if (opts.dryRun) {
    console.log('\nDry-run habilitado: nada será executado.')
    process.exit(0)
  }

  const client = new pg.Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  })

  await client.connect()
  try {
    for (const m of queue) await applyOne(client, m, false)
    console.log(`\nConcluído: ${queue.length} migration(s) aplicada(s).`)
  } finally {
    await client.end()
  }
}

await main().catch((err) => {
  console.error('\nAbortado:', err.message)
  process.exit(1)
})
