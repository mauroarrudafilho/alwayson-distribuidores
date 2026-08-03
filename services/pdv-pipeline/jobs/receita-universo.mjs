#!/usr/bin/env node
/**
 * Etapa 1 — Universo Receita Federal → alwayson_pdv_universo.
 *
 * Espera os CSVs extraídos dos ZIPs mensais da Receita (não baixa automaticamente
 * ainda — o download é ~GB e muda todo mês).
 *
 * Layout dos arquivos: dados abertos CNPJ (Estabelecimentos*, Empresas*, Simples*).
 *
 * Uso:
 *   node services/pdv-pipeline/jobs/receita-universo.mjs --uf PE --data-dir ./data/receita
 *   node services/pdv-pipeline/jobs/receita-universo.mjs --uf PE --data-dir ./data/receita --dry-run
 *   node services/pdv-pipeline/jobs/receita-universo.mjs --uf PE --data-dir ./data/receita --limit 100
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (via .env.local)
 */

import { cnaeQualificado, SITUACAO_CADASTRAL_ATIVA } from '../lib/cnaes.mjs'
import { cnpjRaiz, montaCnpj } from '../lib/cnpj.mjs'
import { listReceitaCsvFiles, streamReceitaCsv } from '../lib/csv-receita.mjs'
import { loadDotenv } from '../lib/dotenv.mjs'
import {
  concluirExecucao,
  criarExecucao,
  ETAPAS,
  falharExecucao,
} from '../lib/execucoes.mjs'
import { createServiceClient } from '../lib/supabase.mjs'

loadDotenv()

const BATCH = 400

function parseArgs(argv) {
  const out = { uf: 'PE', dataDir: process.env.RECEITA_DATA_DIR || '', dryRun: false, limit: 0 }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--uf') out.uf = String(argv[++i] ?? 'PE').toUpperCase()
    else if (a === '--data-dir') out.dataDir = String(argv[++i] ?? '')
    else if (a === '--dry-run') out.dryRun = true
    else if (a === '--limit') out.limit = Number(argv[++i] ?? 0)
    else if (a === '--help' || a === '-h') {
      console.log(`Uso: receita-universo.mjs --uf PE --data-dir PATH [--dry-run] [--limit N]`)
      process.exit(0)
    }
  }
  return out
}

async function carregarIbgePorCodigo(supabase) {
  const map = new Map()
  const pageSize = 1000
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from('alwayson_ibge_municipio_populacao')
      .select('codigo_ibge, cidade_exibicao, estado')
      .range(from, from + pageSize - 1)
    if (error) throw error
    if (!data?.length) break
    for (const row of data) {
      map.set(row.codigo_ibge, {
        municipio: row.cidade_exibicao,
        uf: row.estado,
      })
    }
    if (data.length < pageSize) break
    from += pageSize
  }
  return map
}

async function indexarEmpresas(dataDir, basesNecessarios) {
  const map = new Map()
  const files = listReceitaCsvFiles(dataDir, 'empresas')
  if (!files.length) {
    console.warn('Aviso: nenhum Empresas*.CSV — razão social e porte ficarão vazios.')
    return map
  }
  for (const file of files) {
    await streamReceitaCsv(file, (cols) => {
      const basico = cols[0]
      if (!basesNecessarios.has(basico)) return
      map.set(basico, {
        razao_social: cols[1] || null,
        porte: cols[5] || null,
        capital_social: cols[4] ? Number(String(cols[4]).replace(',', '.')) : null,
      })
    })
  }
  return map
}

async function indexarSimples(dataDir, basesNecessarios) {
  const map = new Map()
  const files = listReceitaCsvFiles(dataDir, 'simples')
  for (const file of files) {
    await streamReceitaCsv(file, (cols) => {
      const basico = cols[0]
      if (!basesNecessarios.has(basico)) return
      map.set(basico, {
        opcao_simples: cols[2] === 'S',
        opcao_mei: cols[3] === 'S',
      })
    })
  }
  return map
}

function parseSecundarios(raw) {
  if (!raw?.trim()) return []
  return raw.split(',').map((s) => s.trim()).filter(Boolean)
}

function rowToUniverso(cols, empresas, simples, ibgeMap) {
  const cnaeHit = cnaeQualificado(cols[11], cols[12])
  if (!cnaeHit) return null

  const cnpj = montaCnpj(cols[0], cols[1], cols[2])
  const basico = cols[0]
  const emp = empresas.get(basico) ?? {}
  const sim = simples.get(basico) ?? {}
  const codigoIbge = cols[20] ? Number(String(cols[20]).replace(/\D/g, '')) : null
  const ibge = codigoIbge ? ibgeMap.get(codigoIbge) : null

  const logradouro = [cols[13], cols[14]].filter(Boolean).join(' ').trim() || cols[14] || null

  return {
    cnpj,
    cnpj_raiz: cnpjRaiz(cnpj),
    razao_social: emp.razao_social ?? null,
    nome_fantasia: cols[4] || null,
    cnae_principal: cnaeHit,
    cnae_secundarios: parseSecundarios(cols[12]),
    situacao_cadastral: cols[5] || null,
    data_abertura: cols[10] || null,
    porte: emp.porte ?? null,
    opcao_simples: sim.opcao_simples ?? null,
    opcao_mei: sim.opcao_mei ?? null,
    capital_social: emp.capital_social ?? null,
    logradouro,
    numero: cols[15] || null,
    complemento: cols[16] || null,
    bairro: cols[17] || null,
    municipio: ibge?.municipio ?? null,
    uf: cols[19] || ibge?.uf || null,
    cep: cols[18]?.replace(/\D/g, '').padStart(8, '0').slice(0, 8) || null,
    codigo_ibge: codigoIbge,
    fonte_geo: 'nulo',
    atualizado_em: new Date().toISOString(),
  }
}

async function upsertLote(supabase, rows) {
  if (!rows.length) return
  const { error } = await supabase.from('alwayson_pdv_universo').upsert(rows, { onConflict: 'cnpj' })
  if (error) throw error
}

export async function runReceitaUniverso(opts) {
  const { uf, dataDir, dryRun, limit } = opts
  if (!dataDir) {
    throw new Error('Informe --data-dir ou RECEITA_DATA_DIR com os CSVs extraídos da Receita.')
  }

  const estabFiles = listReceitaCsvFiles(dataDir, 'estabele')
  if (!estabFiles.length) {
    throw new Error(`Nenhum Estabelecimentos*.CSV em ${dataDir}`)
  }

  console.log(`[receita] UF=${uf} arquivos=${estabFiles.length} dryRun=${dryRun}`)

  /** @type {Map<string, string[]>} */
  const estabFiltrados = new Map()
  const basesNecessarios = new Set()
  let lidas = 0
  let candidatas = 0

  for (const file of estabFiles) {
    await streamReceitaCsv(file, (cols) => {
      lidas++
      if (cols[19]?.toUpperCase() !== uf) return
      if (cols[5] !== SITUACAO_CADASTRAL_ATIVA) return
      if (!cnaeQualificado(cols[11], cols[12])) return
      const cnpj = montaCnpj(cols[0], cols[1], cols[2])
      estabFiltrados.set(cnpj, cols)
      basesNecessarios.add(cols[0])
      candidatas++
      if (limit > 0 && candidatas >= limit) return
    })
    if (limit > 0 && candidatas >= limit) break
  }

  console.log(`[receita] linhas lidas≈${lidas} candidatas UF=${uf}: ${estabFiltrados.size}`)

  const empresas = dryRun ? new Map() : await indexarEmpresas(dataDir, basesNecessarios)
  const simples = dryRun ? new Map() : await indexarSimples(dataDir, basesNecessarios)
  if (!dryRun) {
    console.log(`[receita] empresas indexadas=${empresas.size} simples=${simples.size}`)
  }

  const supabase = dryRun ? null : createServiceClient()
  const ibgeMap = dryRun ? new Map() : await carregarIbgePorCodigo(supabase)

  let execId = opts.execId ?? null
  const gerenciaAuditoria = opts.gerenciaAuditoria !== false
  if (supabase && !execId && gerenciaAuditoria) {
    execId = await criarExecucao(supabase, ETAPAS.receita_universo, { uf, dataDir, limit: limit || null })
  }

  try {
    let buffer = []
    let gravadas = 0
    for (const cols of estabFiltrados.values()) {
      const row = rowToUniverso(cols, empresas, simples, ibgeMap)
      if (!row) continue
      buffer.push(row)
      if (buffer.length >= BATCH) {
        if (!dryRun) await upsertLote(supabase, buffer)
        gravadas += buffer.length
        buffer = []
        if (gravadas % 2000 === 0) console.log(`[receita] gravadas ${gravadas}`)
      }
    }
    if (buffer.length) {
      if (!dryRun) await upsertLote(supabase, buffer)
      gravadas += buffer.length
    }

    const resultado = {
      uf,
      linhas_lidas: lidas,
      candidatas: estabFiltrados.size,
      gravadas: dryRun ? 0 : gravadas,
      dry_run: dryRun,
    }
    console.log('[receita] concluído', resultado)

    if (execId && gerenciaAuditoria) await concluirExecucao(supabase, execId, resultado)
    return resultado
  } catch (err) {
    if (execId && supabase && gerenciaAuditoria) await falharExecucao(supabase, execId, err)
    throw err
  }
}

const isMain = process.argv[1]?.includes('receita-universo')
if (isMain) {
  runReceitaUniverso(parseArgs(process.argv)).catch((err) => {
    console.error('[receita] falha:', err.message)
    process.exit(1)
  })
}
