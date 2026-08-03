#!/usr/bin/env node
/**
 * Etapa cruzamento — carteira × potencial → alwayson_pdv_prioridade.
 *
 * Uso:
 *   node services/pdv-pipeline/jobs/cruzamento.mjs --piloto petrolina
 */

import { loadDotenv } from '../lib/dotenv.mjs'
import {
  carregarClientes,
  carregarCompraMediaPorCliente,
  carregarFornecedorAtivo,
  carregarUniversoComScoreFiltrado,
  montarPrioridades,
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
    mesesJanela: 12,
    dryRun: false,
    distribuidorId: process.env.PDV_PILOTO_DISTRIBUIDOR_ID || '',
  }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--dry-run') out.dryRun = true
    else if (a === '--distribuidor-id') out.distribuidorId = String(argv[++i] ?? '')
    else if (a === '--meses') out.mesesJanela = Number(argv[++i] ?? 12)
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

async function limparPrioridade(supabase, distribuidorId, fornecedorId, versaoModelo, codigosIbge) {
  const { data: cnps } = await supabase
    .from('alwayson_pdv_universo')
    .select('cnpj')
    .in('codigo_ibge', codigosIbge)
  const cnpjList = cnps?.map((r) => r.cnpj) ?? []
  if (!cnpjList.length) return

  for (let i = 0; i < cnpjList.length; i += 500) {
    const { error } = await supabase
      .from('alwayson_pdv_prioridade')
      .delete()
      .eq('distribuidor_id', distribuidorId)
      .eq('fornecedor_tenant_id', fornecedorId)
      .eq('versao_modelo', versaoModelo)
      .in('cnpj', cnpjList.slice(i, i + 500))
    if (error) throw error
  }
}

export async function runCruzamento({
  codigosIbge,
  distribuidorId,
  versaoModelo = VERSAO_MODELO_V1,
  mesesJanela = 12,
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
    execId = await criarExecucao(sb, ETAPAS.cruzamento, {
      codigos_ibge: codigosIbge,
      distribuidor_id: distribuidorId,
      versao_modelo: versaoModelo,
    })
  }

  try {
    const fornecedorTenantId = await carregarFornecedorAtivo(sb, distribuidorId)
    const universo = await carregarUniversoComScoreFiltrado(sb, codigosIbge, versaoModelo)
    const clientes = await carregarClientes(sb, distribuidorId)
    const compra = await carregarCompraMediaPorCliente(
      sb,
      distribuidorId,
      fornecedorTenantId,
      mesesJanela
    )

    const prioridades = montarPrioridades({
      universo,
      clientesPorCnpj: clientes,
      compraPorClienteId: compra,
      distribuidorId,
      fornecedorTenantId,
      versaoModelo,
    })

    const porSegmento = {}
    for (const p of prioridades) {
      porSegmento[p.segmento] = (porSegmento[p.segmento] ?? 0) + 1
    }

    if (!dryRun) {
      await limparPrioridade(sb, distribuidorId, fornecedorTenantId, versaoModelo, codigosIbge)
      for (let i = 0; i < prioridades.length; i += BATCH) {
        const { error } = await sb.from('alwayson_pdv_prioridade').insert(prioridades.slice(i, i + BATCH))
        if (error) throw error
      }
    }

    const resultado = {
      codigos_ibge: codigosIbge,
      distribuidor_id: distribuidorId,
      fornecedor_tenant_id: fornecedorTenantId,
      versao_modelo: versaoModelo,
      universo_com_score: universo.length,
      clientes_carteira: clientes.size,
      prioridades: prioridades.length,
      por_segmento: porSegmento,
      dry_run: dryRun,
    }
    console.log('[cruzamento]', resultado)

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

const isMain = process.argv[1]?.includes('cruzamento.mjs')
if (isMain) {
  const args = parseArgs(process.argv)
  if (!args.codigosIbge.length) {
    console.error('Informe --piloto petrolina ou --codigo-ibge')
    process.exit(1)
  }
  runCruzamento({
    codigosIbge: args.codigosIbge,
    distribuidorId: args.distribuidorId,
    versaoModelo: args.versaoModelo,
    mesesJanela: args.mesesJanela,
    dryRun: args.dryRun,
  })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[cruzamento] falha:', err.message)
      process.exit(1)
    })
}
