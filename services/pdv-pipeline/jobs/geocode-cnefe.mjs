#!/usr/bin/env node
/**
 * Etapa CNEFE — geocode em alwayson_pdv_universo.
 *
 * Cascata: logradouro+número+CEP → logradouro+CEP → centroide de CEP.
 *
 * Uso:
 *   node services/pdv-pipeline/jobs/geocode-cnefe.mjs --piloto petrolina
 *   node services/pdv-pipeline/jobs/geocode-cnefe.mjs --codigo-ibge 2611101 --data-dir ./data/cnefe --dry-run
 */

import { loadDotenv } from '../lib/dotenv.mjs'
import {
  carregarIndiceCnefe,
  casarEndereco,
  resolverCsvCnefe,
} from '../lib/cnefe-index.mjs'
import {
  concluirExecucao,
  criarExecucao,
  ETAPAS,
  falharExecucao,
} from '../lib/execucoes.mjs'
import { parseCodigosIbge, PILOTO_PETROLINA } from '../lib/piloto.mjs'
import { createServiceClient } from '../lib/supabase.mjs'

loadDotenv()

const BATCH = 100
const PAGE = 1000

function parseArgs(argv) {
  const out = {
    codigosIbge: [],
    dataDir: process.env.CNEFE_DATA_DIR || './data/cnefe',
    dryRun: false,
    limit: 0,
  }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--dry-run') out.dryRun = true
    if (a === '--data-dir') out.dataDir = String(argv[++i] ?? out.dataDir)
    else if (a === '--limit') out.limit = Number(argv[++i] ?? 0)
    else if (a === '--codigo-ibge') out.codigosIbge.push(...parseCodigosIbge([argv[++i] ?? '']))
    else if (a === '--piloto') {
      const nome = String(argv[++i] ?? 'petrolina').toLowerCase()
      if (nome !== 'petrolina') throw new Error(`Piloto desconhecido: ${nome}`)
      out.codigosIbge = [PILOTO_PETROLINA.codigo_ibge]
      out.municipioSlug = PILOTO_PETROLINA.municipio
    }
  }
  out.codigosIbge = [...new Set(out.codigosIbge)]
  return out
}

async function carregarUniverso(supabase, codigoIbge, limit) {
  const rows = []
  for (let from = 0; ; from += PAGE) {
    let q = supabase
      .from('alwayson_pdv_universo')
      .select('cnpj, logradouro, numero, cep, bairro, codigo_ibge, fonte_geo')
      .eq('codigo_ibge', codigoIbge)
      .range(from, from + PAGE - 1)
    const { data, error } = await q
    if (error) throw error
    if (!data?.length) break
    rows.push(...data)
    if (limit > 0 && rows.length >= limit) return rows.slice(0, limit)
    if (data.length < PAGE) break
  }
  return rows
}

async function atualizarLote(supabase, updates, concorrencia = 25) {
  for (let i = 0; i < updates.length; i += concorrencia) {
    const slice = updates.slice(i, i + concorrencia)
    await Promise.all(
      slice.map((u) =>
        supabase
          .from('alwayson_pdv_universo')
          .update({
            latitude: u.latitude,
            longitude: u.longitude,
            nivel_geocodificacao: u.nivel_geocodificacao,
            fonte_geo: 'cnefe',
            atualizado_em: new Date().toISOString(),
          })
          .eq('cnpj', u.cnpj)
          .then(({ error }) => {
            if (error) throw error
          })
      )
    )
  }
}

export async function runGeocodeCnefe({
  codigosIbge = [],
  dataDir,
  municipioSlug = 'PETROLINA',
  dryRun = false,
  limit = 0,
  execId = null,
  gerenciaAuditoria = true,
} = {}) {
  if (!codigosIbge.length) throw new Error('Informe codigosIbge')

  const supabase = dryRun ? null : createServiceClient()

  if (gerenciaAuditoria && !execId && !dryRun) {
    execId = await criarExecucao(supabase, ETAPAS.geocode_cnefe, {
      codigos_ibge: codigosIbge,
      data_dir: dataDir,
      dry_run: false,
    })
  }

  try {
    const stats = {
      codigos_ibge: codigosIbge,
      por_nivel: { numero_exato: 0, logradouro: 0, cep: 0, sem_match: 0 },
      dry_run: dryRun,
    }

    for (const codigo of codigosIbge) {
      const csvPath = resolverCsvCnefe(dataDir, codigo, municipioSlug)
      console.log(`[cnefe] indexando ${csvPath}`)
      const indice = await carregarIndiceCnefe(csvPath)
      console.log('[cnefe] índice', indice.stats)

      const universo = await carregarUniverso(
        supabase ?? createServiceClient(),
        codigo,
        limit
      )
      const updates = []

      for (const row of universo) {
        const hit = casarEndereco(indice, row)
        if (!hit) {
          stats.por_nivel.sem_match++
          continue
        }
        stats.por_nivel[hit.nivel_geocodificacao] =
          (stats.por_nivel[hit.nivel_geocodificacao] ?? 0) + 1
        updates.push({
          cnpj: row.cnpj,
          latitude: hit.latitude,
          longitude: hit.longitude,
          nivel_geocodificacao: hit.nivel_geocodificacao,
        })
      }

      if (!dryRun) {
        for (let i = 0; i < updates.length; i += BATCH) {
          await atualizarLote(supabase, updates.slice(i, i + BATCH))
          if ((i + BATCH) % 500 === 0 || i + BATCH >= updates.length) {
            console.log(`[cnefe] gravados ${Math.min(i + BATCH, updates.length)}/${updates.length}`)
          }
        }
      }

      stats.pdvs = universo.length
      stats.geocodificados = updates.length
      stats.taxa =
        universo.length > 0
          ? Number(((updates.length / universo.length) * 100).toFixed(1))
          : 0
    }

    console.log('[cnefe] concluído', stats)

    if (gerenciaAuditoria && execId && !dryRun) {
      await concluirExecucao(supabase, execId, stats)
    }

    return stats
  } catch (err) {
    if (gerenciaAuditoria && execId && supabase) {
      await falharExecucao(supabase, execId, err)
    }
    throw err
  }
}

const isMain = process.argv[1]?.includes('geocode-cnefe')
if (isMain) {
  const args = parseArgs(process.argv)
  if (!args.codigosIbge.length) {
    console.error('Informe --piloto petrolina ou --codigo-ibge')
    process.exit(1)
  }
  runGeocodeCnefe({
    codigosIbge: args.codigosIbge,
    dataDir: args.dataDir,
    municipioSlug: args.municipioSlug ?? 'PETROLINA',
    dryRun: args.dryRun,
    limit: args.limit,
  })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[cnefe] falha:', err.message)
      process.exit(1)
    })
}
