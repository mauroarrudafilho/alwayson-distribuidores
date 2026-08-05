#!/usr/bin/env node
/**
 * Preenche cidade/UF e coordenada dos CNPJs da lista estratégica
 * (`alwayson_clientes_estrategicos`) a partir de **fonte pública**: base
 * Insights primeiro, BrasilAPI (Receita) em seguida, Nominatim opcional.
 *
 * Por que existe: a lista tem 1.327 CNPJs, e só uma dezena está numa tabela
 * que já tenha geo. Sem isto o mapa da tela fica vazio — e um mapa vazio passa
 * a impressão errada de que a praça não tem PDV.
 *
 * ⚠️ Nada aqui vem do relatório de mercado que originou a lista. Endereço e
 * coordenada saem do CNPJ contra fonte pública — ver docs/PENDENCIAS.md §5.
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (+ .env.local).
 *
 * Uso:
 *   npm run estrategicos:enrich-geo
 *   npm run estrategicos:enrich-geo -- --limit 100
 *   npm run estrategicos:enrich-geo -- --uf PE
 *   npm run estrategicos:enrich-geo -- --com-nominatim   # geocodifica endereço
 *   npm run estrategicos:enrich-geo -- --dry-run
 */


import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createClient } from '@supabase/supabase-js'

import {
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
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      const t = line.trim()
      if (!t || t.startsWith('#')) continue
      const eq = t.indexOf('=')
      if (eq < 1) continue
      const k = t.slice(0, eq).trim()
      if (!process.env[k]) process.env[k] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    }
  }
}

function arg(nome, padrao = null) {
  const i = process.argv.indexOf(`--${nome}`)
  if (i === -1) return padrao
  const v = process.argv[i + 1]
  return v && !v.startsWith('--') ? v : true
}

const DRY_RUN = process.argv.includes('--dry-run')
const COM_NOMINATIM = process.argv.includes('--com-nominatim')
const LIMIT = Number(arg('limit', 0)) || 0
const UF = typeof arg('uf') === 'string' ? String(arg('uf')).toUpperCase() : null

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Faltam SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (.env.local).')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
})

/**
 * Só quem ainda não tem coordenada por nenhuma via. Lê pela view para não
 * reprocessar CNPJ que já resolve via carteira / universo PDV / Insights.
 */
async function carregarPendentes() {
  const linhas = []
  for (let from = 0; ; from += 1000) {
    let q = supabase
      .from('alwayson_clientes_estrategicos_v_lista')
      .select('id, cnpj, cidade, estado, lat_exibicao')
      .eq('ativo', true)
      .is('lat_exibicao', null)
      .range(from, from + 999)
    if (UF) q = q.eq('estado_exibicao', UF)

    const { data, error } = await q
    if (error) throw error
    linhas.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return LIMIT ? linhas.slice(0, LIMIT) : linhas
}

async function main() {
  const pendentes = await carregarPendentes()
  console.log(
    `Pendentes de coordenada${UF ? ` em ${UF}` : ''}: ${pendentes.length}` +
      (DRY_RUN ? '  (dry-run)' : '')
  )
  if (!pendentes.length) return

  const porCnpj = new Map(pendentes.map((l) => [normalizeCnpjDigits(l.cnpj), l]))

  const resolvidos = await resolveClienteCidadesBatch(supabase, [...porCnpj.keys()], {
    useNominatim: COM_NOMINATIM,
    brasilDelayMs: 350,
    onProgress: (i, total) => {
      if (i % 25 === 0 || i === total) process.stdout.write(`\r  resolvendo ${i}/${total}`)
    },
    onWarning: () => {},
  })
  process.stdout.write('\n')

  let comGeo = 0
  let soCidade = 0
  let semNada = 0
  const patches = []

  for (const [cnpj, r] of resolvidos) {
    const linha = porCnpj.get(cnpj)
    if (!linha) continue

    const patch = { id: linha.id }
    let util = false

    // Cidade/UF só entram se ainda estiverem vazias na própria linha — a
    // planilha de origem já tinha preenchido boa parte delas.
    if (!linha.cidade && r?.cidade) {
      patch.cidade = String(r.cidade).trim()
      util = true
    }
    if (!linha.estado && r?.estado) {
      patch.estado = String(r.estado).trim().toUpperCase().slice(0, 2)
      util = true
    }

    if (r?.lat != null && r?.lng != null && Number.isFinite(r.lat) && Number.isFinite(r.lng)) {
      patch.lat = r.lat
      patch.lng = r.lng
      // O CHECK da coluna é lista fechada — rotular errado rebenta a gravação.
      const FONTES_OK = new Set(['receita_cnefe', 'brasilapi', 'nominatim', 'insights'])
      patch.geo_fonte = FONTES_OK.has(r.source) ? r.source : 'brasilapi'
      patch.geo_atualizado_em = new Date().toISOString()
      util = true
      comGeo++
    } else if (r?.cidade) {
      soCidade++
    } else {
      semNada++
    }

    if (util) patches.push(patch)
  }

  console.log(
    `  com coordenada: ${comGeo} · só cidade/UF: ${soCidade} · sem nada: ${semNada}`
  )

  if (DRY_RUN) {
    console.log(`Dry-run: ${patches.length} linhas seriam atualizadas.`)
    return
  }

  let gravadas = 0
  for (const p of patches) {
    const { id, ...campos } = p
    const { error } = await supabase
      .from('alwayson_clientes_estrategicos')
      .update(campos)
      .eq('id', id)
    if (error) {
      console.error(`  falhou ${id}: ${error.message}`)
      continue
    }
    gravadas++
  }
  console.log(`Gravadas: ${gravadas}/${patches.length}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
