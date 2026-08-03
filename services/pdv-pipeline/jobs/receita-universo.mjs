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
 *   node services/pdv-pipeline/jobs/receita-universo.mjs --uf PE --data-dir ./data/receita --codigo-ibge 2611101
 *   node services/pdv-pipeline/jobs/receita-universo.mjs --piloto petrolina --data-dir ./data/receita --dry-run
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
import {
  carregarMunicipiosReceita,
  chaveReceitaMunicipio,
  filtroReceitaPorIbge,
  resolveCodigoIbge,
} from '../lib/municipios-receita.mjs'
import {
  parseCodigosIbge,
  PILOTO_PETROLINA,
} from '../lib/piloto.mjs'

loadDotenv()

const BATCH = 400

function parseArgs(argv) {
  const out = {
    uf: 'PE',
    dataDir: process.env.RECEITA_DATA_DIR || '',
    dryRun: false,
    limit: 0,
    codigosIbge: [],
  }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--uf') out.uf = String(argv[++i] ?? 'PE').toUpperCase()
    else if (a === '--data-dir') out.dataDir = String(argv[++i] ?? '')
    else if (a === '--dry-run') out.dryRun = true
    else if (a === '--limit') out.limit = Number(argv[++i] ?? 0)
    else if (a === '--codigo-ibge') out.codigosIbge.push(...parseCodigosIbge([argv[++i] ?? '']))
    else if (a === '--piloto') {
      const nome = String(argv[++i] ?? 'petrolina').toLowerCase()
      if (nome !== 'petrolina') {
        throw new Error(`Piloto desconhecido: ${nome}. Disponível: petrolina`)
      }
      out.uf = PILOTO_PETROLINA.uf
      out.codigosIbge = [PILOTO_PETROLINA.codigo_ibge]
    } else if (a === '--help' || a === '-h') {
      console.log(
        `Uso: receita-universo.mjs --piloto petrolina --data-dir PATH [--dry-run]\n` +
          `     receita-universo.mjs --uf PE --codigo-ibge 2611101 --data-dir PATH`
      )
      process.exit(0)
    }
  }
  out.codigosIbge = [...new Set(out.codigosIbge)]
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
      const codigo = Number(row.codigo_ibge)
      map.set(codigo, {
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

function rowToUniverso(cols, empresas, simples, ibgeMap, municipiosReceita, uf) {
  const cnaeHit = cnaeQualificado(cols[11], cols[12])
  if (!cnaeHit) return null

  const cnpj = montaCnpj(cols[0], cols[1], cols[2])
  const basico = cols[0]
  const emp = empresas.get(basico) ?? {}
  const sim = simples.get(basico) ?? {}
  const codigoIbge = resolveCodigoIbge(cols, uf, municipiosReceita, ibgeMap)
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

async function upsertLote(supabase, rows, ibgeMap) {
  if (!rows.length) return
  const safe = rows.map((row) => {
    const codigo = row.codigo_ibge != null ? Number(row.codigo_ibge) : null
    if (codigo != null && !ibgeMap.has(codigo)) {
      return { ...row, codigo_ibge: null }
    }
    return row
  })
  const { error } = await supabase.from('alwayson_pdv_universo').upsert(safe, { onConflict: 'cnpj' })
  if (error) throw error
}

export async function runReceitaUniverso(opts) {
  const { uf, dataDir, dryRun, limit, codigosIbge } = opts
  const filtroIbge = codigosIbge?.length ? new Set(codigosIbge.map(Number)) : null
  if (!dataDir) {
    throw new Error('Informe --data-dir ou RECEITA_DATA_DIR com os CSVs extraídos da Receita.')
  }

  const estabFiles = listReceitaCsvFiles(dataDir, 'estabele')
  if (!estabFiles.length) {
    throw new Error(`Nenhum Estabelecimentos*.CSV em ${dataDir}`)
  }

  const supabase = dryRun ? null : createServiceClient()
  const ibgeMap = await carregarIbgePorCodigo(supabase ?? createServiceClient())
  let municipiosReceita = new Map()
  if (filtroIbge || !dryRun) {
    municipiosReceita = await carregarMunicipiosReceita(dataDir)
  }
  const filtroReceita = filtroIbge
    ? filtroReceitaPorIbge([...filtroIbge], uf, municipiosReceita, ibgeMap)
    : null

  if (filtroIbge && filtroReceita.size === 0) {
    throw new Error(
      `Nenhum município Receita mapeado para IBGE [${[...filtroIbge].join(', ')}]. Confira Municipios.zip.`
    )
  }

  console.log(
    `[receita] UF=${uf} arquivos=${estabFiles.length} dryRun=${dryRun}` +
      (filtroReceita ? ` municípios_receita=[${[...filtroReceita].join(',')}]` : '')
  )

  /** @type {Map<string, string[]>} */
  const estabFiltrados = new Map()
  const basesNecessarios = new Set()
  let lidas = 0
  let candidatas = 0

  for (const file of estabFiles) {
    await streamReceitaCsv(file, (cols) => {
      lidas++
      if (filtroReceita) {
        const chave = chaveReceitaMunicipio(cols, uf)
        if (!chave || !filtroReceita.has(chave)) return
      }
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

  console.log(
    `[receita] linhas lidas≈${lidas} candidatas` +
      (filtroIbge ? ` município(s)` : ` UF=${uf}`) +
      `: ${estabFiltrados.size}`
  )

  const empresas = dryRun ? new Map() : await indexarEmpresas(dataDir, basesNecessarios)
  const simples = dryRun ? new Map() : await indexarSimples(dataDir, basesNecessarios)
  if (!dryRun) {
    console.log(`[receita] empresas indexadas=${empresas.size} simples=${simples.size}`)
  }

  let execId = opts.execId ?? null
  const gerenciaAuditoria = opts.gerenciaAuditoria !== false
  if (supabase && !execId && gerenciaAuditoria) {
    execId = await criarExecucao(supabase, ETAPAS.receita_universo, {
      uf,
      dataDir,
      limit: limit || null,
      codigos_ibge: filtroIbge ? [...filtroIbge] : null,
    })
  }

  try {
    let buffer = []
    let gravadas = 0
    for (const cols of estabFiltrados.values()) {
      const row = rowToUniverso(cols, empresas, simples, ibgeMap, municipiosReceita, uf)
      if (!row) continue
      buffer.push(row)
      if (buffer.length >= BATCH) {
        if (!dryRun) await upsertLote(supabase, buffer, ibgeMap)
        gravadas += buffer.length
        buffer = []
        if (!dryRun && gravadas % 2000 === 0) console.log(`[receita] gravadas ${gravadas}`)
      }
    }
    if (buffer.length) {
      if (!dryRun) await upsertLote(supabase, buffer, ibgeMap)
      gravadas += buffer.length
    }

    const resultado = {
      uf,
      codigos_ibge: filtroIbge ? [...filtroIbge] : null,
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
