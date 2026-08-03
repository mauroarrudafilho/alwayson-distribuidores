#!/usr/bin/env node
/**
 * Etapa cobertura — qualificados vs atendidos por microrregião → alwayson_pdv_cobertura.
 *
 * Uso:
 *   node services/pdv-pipeline/jobs/cobertura.mjs --piloto petrolina
 */

import { loadDotenv } from '../lib/dotenv.mjs'
import {
  carregarClientes,
  carregarFornecedorAtivo,
  carregarUniversoComScoreFiltrado,
  montarCobertura,
} from '../lib/cruzamento-cobertura.mjs'
import {
  concluirExecucao,
  criarExecucao,
  ETAPAS,
  falharExecucao,
} from '../lib/execucoes.mjs'
import { parseCodigosIbge, PILOTO_PETROLINA } from '../lib/piloto.mjs'
import { VERSAO_MODELO_V2 } from '../lib/score-v2.mjs'
import { createServiceClient } from '../lib/supabase.mjs'

loadDotenv()

const BATCH = 200

function parseArgs(argv) {
  const out = {
    codigosIbge: [],
    versaoModelo: VERSAO_MODELO_V2,
    dryRun: false,
    distribuidorId: process.env.PDV_PILOTO_DISTRIBUIDOR_ID || '',
  }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--dry-run') out.dryRun = true
    else if (a === '--distribuidor-id') out.distribuidorId = String(argv[++i] ?? '')
    else if (a === '--versao-modelo') out.versaoModelo = String(argv[++i] ?? VERSAO_MODELO_V2)
    else if (a === '--codigo-ibge') out.codigosIbge.push(...parseCodigosIbge([argv[++i] ?? '']))
    else if (a === '--piloto') {
      const nome = String(argv[++i] ?? 'petrolina').toLowerCase()
      if (nome !== 'petrolina') throw new Error(`Piloto desconhecido: ${nome}`)
      out.codigosIbge = [PILOTO_PETROLINA.codigo_ibge]
      out.distribuidorId = out.distribuidorId || PILOTO_PETROLINA.distribuidor_id
    }
  }
  out.codigosIbge = [...new Set(out.codigosIbge)]
  return out
}

async function limparCobertura(supabase, distribuidorId, fornecedorId, codigosIbge) {
  const { error } = await supabase
    .from('alwayson_pdv_cobertura')
    .delete()
    .eq('distribuidor_id', distribuidorId)
    .eq('fornecedor_tenant_id', fornecedorId)
    .in('codigo_ibge', codigosIbge)
  if (error) throw error
}

export async function runCobertura({
  codigosIbge,
  distribuidorId,
  versaoModelo = VERSAO_MODELO_V1,
  dryRun = false,
  execId = null,
  gerenciaAuditoria = true,
} = {}) {
  if (!codigosIbge?.length || !distribuidorId) {
    throw new Error('Informe codigosIbge e distribuidorId')
  }

  const supabase = dryRun ? null : createServiceClient()
  const sb = supabase ?? createServiceClient()

  if (gerenciaAuditoria && !execId && !dryRun) {
    execId = await criarExecucao(sb, ETAPAS.cobertura, {
      codigos_ibge: codigosIbge,
      distribuidor_id: distribuidorId,
      versao_modelo: versaoModelo,
    })
  }

  try {
    const fornecedorTenantId = await carregarFornecedorAtivo(sb, distribuidorId)
    const universo = await carregarUniversoComScoreFiltrado(sb, codigosIbge, versaoModelo)
    const clientes = await carregarClientes(sb, distribuidorId)
    const cobertura = montarCobertura({
      universo,
      clientesPorCnpj: clientes,
      distribuidorId,
      fornecedorTenantId,
    })

    const totais = cobertura.reduce(
      (acc, g) => {
        acc.qualificados += g.qtd_qualificados
        acc.atendidos += g.qtd_atendidos
        acc.potencial_nao_atendido += g.potencial_nao_atendido
        return acc
      },
      { qualificados: 0, atendidos: 0, potencial_nao_atendido: 0 }
    )

    if (!dryRun) {
      await limparCobertura(sb, distribuidorId, fornecedorTenantId, codigosIbge)
      for (let i = 0; i < cobertura.length; i += BATCH) {
        const { error } = await sb.from('alwayson_pdv_cobertura').insert(cobertura.slice(i, i + BATCH))
        if (error) throw error
      }
    }

    const resultado = {
      codigos_ibge: codigosIbge,
      distribuidor_id: distribuidorId,
      fornecedor_tenant_id: fornecedorTenantId,
      grupos: cobertura.length,
      ...totais,
      percentual_cobertura:
        totais.qualificados > 0
          ? Number(((totais.atendidos / totais.qualificados) * 100).toFixed(2))
          : null,
      dry_run: dryRun,
    }
    console.log('[cobertura]', resultado)

    if (gerenciaAuditoria && execId && supabase) {
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

const isMain = process.argv[1]?.includes('cobertura.mjs')
if (isMain) {
  const args = parseArgs(process.argv)
  if (!args.codigosIbge.length) {
    console.error('Informe --piloto petrolina ou --codigo-ibge')
    process.exit(1)
  }
  runCobertura({
    codigosIbge: args.codigosIbge,
    distribuidorId: args.distribuidorId,
    versaoModelo: args.versaoModelo,
    dryRun: args.dryRun,
  })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[cobertura] falha:', err.message)
      process.exit(1)
    })
}
