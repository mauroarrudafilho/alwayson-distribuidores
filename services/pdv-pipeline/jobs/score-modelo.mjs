#!/usr/bin/env node
/**
 * Etapa 2 — Score de relevância → alwayson_pdv_score.
 *
 * v1 (consolidacao_v1): rede + maturidade
 * v2 (consolidacao_v2): capital + porte + rede + maturidade + CNAE secundários
 *
 * Uso:
 *   node services/pdv-pipeline/jobs/score-modelo.mjs --piloto petrolina
 *   node services/pdv-pipeline/jobs/score-modelo.mjs --piloto petrolina --versao v2
 */

import { loadDotenv } from '../lib/dotenv.mjs'
import {
  concluirExecucao,
  criarExecucao,
  ETAPAS,
  falharExecucao,
} from '../lib/execucoes.mjs'
import { parseCodigosIbge, PILOTO_PETROLINA } from '../lib/piloto.mjs'
import {
  atribuirFaixas as atribuirFaixasV1,
  calcularScoreV1,
  VERSAO_MODELO_V1,
} from '../lib/score-v1.mjs'
import {
  atribuirFaixas as atribuirFaixasV2,
  calcularScoresV2,
  VERSAO_MODELO_V2,
} from '../lib/score-v2.mjs'
import { createServiceClient } from '../lib/supabase.mjs'

loadDotenv()

const BATCH = 400
const PAGE = 1000

function parseArgs(argv) {
  const out = { codigosIbge: [], dryRun: false, versao: 'v1' }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--dry-run') out.dryRun = true
    else if (a === '--versao') out.versao = String(argv[++i] ?? 'v1').toLowerCase()
    else if (a === '--codigo-ibge') out.codigosIbge.push(...parseCodigosIbge([argv[++i] ?? '']))
    else if (a === '--piloto') {
      const nome = String(argv[++i] ?? 'petrolina').toLowerCase()
      if (nome !== 'petrolina') throw new Error(`Piloto desconhecido: ${nome}`)
      out.codigosIbge = [PILOTO_PETROLINA.codigo_ibge]
    }
  }
  out.codigosIbge = [...new Set(out.codigosIbge)]
  return out
}

function resolveVersao(versaoArg) {
  if (versaoArg === 'v2' || versaoArg === 'consolidacao_v2') {
    return { key: 'v2', versaoModelo: VERSAO_MODELO_V2 }
  }
  return { key: 'v1', versaoModelo: VERSAO_MODELO_V1 }
}

async function carregarUniverso(supabase, codigosIbge, versaoKey) {
  const colsV1 =
    'cnpj, cnpj_raiz, cnae_principal, data_abertura, nivel_geocodificacao, codigo_ibge'
  const colsV2 =
    'cnpj, cnpj_raiz, cnae_principal, cnae_secundarios, data_abertura, porte, capital_social, nivel_geocodificacao, codigo_ibge'
  const select = versaoKey === 'v2' ? colsV2 : colsV1

  const rows = []
  for (const codigo of codigosIbge.length ? codigosIbge : [null]) {
    for (let from = 0; ; from += PAGE) {
      let q = supabase.from('alwayson_pdv_universo').select(select).range(from, from + PAGE - 1)
      if (codigo != null) q = q.eq('codigo_ibge', codigo)
      const { data, error } = await q
      if (error) throw error
      if (!data?.length) break
      rows.push(...data)
      if (data.length < PAGE) break
    }
  }
  return rows
}

function contagemPorRaiz(rows) {
  const map = new Map()
  for (const r of rows) {
    map.set(r.cnpj_raiz, (map.get(r.cnpj_raiz) ?? 0) + 1)
  }
  return map
}

async function upsertScores(supabase, batch) {
  const { error } = await supabase.from('alwayson_pdv_score').upsert(batch, {
    onConflict: 'cnpj,versao_modelo',
  })
  if (error) throw error
}

export async function runScoreModelo({
  codigosIbge = [],
  dryRun = false,
  versao = 'v1',
  execId = null,
  gerenciaAuditoria = true,
} = {}) {
  const { key: versaoKey, versaoModelo } = resolveVersao(versao)
  const supabase = dryRun ? null : createServiceClient()

  if (gerenciaAuditoria && !execId && !dryRun) {
    execId = await criarExecucao(supabase, ETAPAS.score_modelo, {
      codigos_ibge: codigosIbge.length ? codigosIbge : null,
      versao_modelo: versaoModelo,
      dry_run: false,
    })
  }

  try {
    const universo = await carregarUniverso(supabase ?? createServiceClient(), codigosIbge, versaoKey)
    const porRaiz = contagemPorRaiz(universo)

    let resultados
    if (versaoKey === 'v2') {
      const rows = universo.map((row) => ({
        ...row,
        qtd_estabelecimentos_raiz: porRaiz.get(row.cnpj_raiz) ?? 1,
      }))
      const porCidade = new Map()
      for (const row of rows) {
        const k = row.codigo_ibge ?? 0
        if (!porCidade.has(k)) porCidade.set(k, [])
        porCidade.get(k).push(row)
      }
      resultados = []
      for (const cidadeRows of porCidade.values()) {
        const scored = calcularScoresV2(cidadeRows)
        resultados.push(...atribuirFaixasV2(scored))
      }
      resultados = resultados.map((r) => ({ ...r, versao_modelo: VERSAO_MODELO_V2 }))
    } else {
      resultados = universo.map((row) => {
        const qtd = porRaiz.get(row.cnpj_raiz) ?? 1
        const calc = calcularScoreV1({ ...row, qtd_estabelecimentos_raiz: qtd })
        return {
          cnpj: row.cnpj,
          versao_modelo: VERSAO_MODELO_V1,
          ...calc,
        }
      })
      resultados = atribuirFaixasV1(resultados)
    }

    if (!dryRun) {
      for (let i = 0; i < resultados.length; i += BATCH) {
        const slice = resultados.slice(i, i + BATCH).map((r) => ({
          cnpj: r.cnpj,
          versao_modelo: r.versao_modelo,
          score_potencial: r.score_potencial,
          faixa: r.faixa,
          potencial_estimado_mensal: r.potencial_estimado_mensal,
          features: r.features,
          calculado_em: new Date().toISOString(),
        }))
        await upsertScores(supabase, slice)
      }
    }

    const faixas = { A: 0, B: 0, C: 0, D: 0 }
    for (const r of resultados) faixas[r.faixa] = (faixas[r.faixa] ?? 0) + 1

    const resultado = {
      versao_modelo: versaoModelo,
      codigos_ibge: codigosIbge.length ? codigosIbge : null,
      pdvs: resultados.length,
      faixas,
      dry_run: dryRun,
      com_geo_cnefe: resultados.filter(
        (r) => r.features?.nivel_geocodificacao && r.features.nivel_geocodificacao !== 'nulo'
      ).length,
    }

    console.log('[score]', resultado)

    if (gerenciaAuditoria && execId && !dryRun) {
      await concluirExecucao(supabase, execId, resultado)
    }

    return resultado
  } catch (err) {
    if (gerenciaAuditoria && execId && supabase) {
      await falharExecucao(supabase, execId, err)
    }
    throw err
  }
}

const isMain = process.argv[1]?.includes('score-modelo')
if (isMain) {
  const args = parseArgs(process.argv)
  if (!args.codigosIbge.length) {
    console.error('Informe --piloto petrolina ou --codigo-ibge')
    process.exit(1)
  }
  runScoreModelo({ codigosIbge: args.codigosIbge, dryRun: args.dryRun, versao: args.versao })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[score] falha:', err.message)
      process.exit(1)
    })
}
