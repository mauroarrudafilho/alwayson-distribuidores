#!/usr/bin/env node
/**
 * Gera metas demo de faturamento (maio/2026) a partir do sell-in ingerido.
 * Metade dos vendedores com meta ~10% acima do realizado (atinge), metade ~12% abaixo.
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (ou .env.local)
 *
 * Uso:
 *   node scripts/seed-metas-demo-maio-2026.mjs
 *   node scripts/seed-metas-demo-maio-2026.mjs --dry-run
 *   node scripts/seed-metas-demo-maio-2026.mjs --rollup-only   # só propaga soma dos filhos
 */

/* eslint-disable no-console */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

const PERIODO_INICIO = '2026-05-01'
const PERIODO_FIM = '2026-05-31'
const OBS =
  'Demo maio/2026 — meta simulada a partir do faturamento ingerido (script seed-metas-demo-maio-2026).'

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
      const key = t.slice(0, eq).trim()
      let val = t.slice(eq + 1).trim()
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
        val = val.slice(1, -1)
      if (!(key in process.env)) process.env[key] = val
    }
    break
  }
}

async function upsertMeta(sb, payload) {
  let busca = sb
    .from('alwayson_metas_distribuidor')
    .select('id')
    .eq('distribuidor_id', payload.distribuidor_id)
    .eq('tipo', payload.tipo)
    .eq('periodo_inicio', payload.periodo_inicio)
    .eq('periodo_fim', payload.periodo_fim)

  busca = payload.vendedor_id
    ? busca.eq('vendedor_id', payload.vendedor_id)
    : busca.is('vendedor_id', null)

  const { data: existente, error: buscaErr } = await busca.maybeSingle()
  if (buscaErr) throw buscaErr

  if (existente?.id) {
    const { error: upErr } = await sb
      .from('alwayson_metas_distribuidor')
      .update({
        valor_meta: payload.valor_meta,
        observacao: payload.observacao,
        hierarquia: payload.hierarquia,
      })
      .eq('id', existente.id)
    if (upErr) throw upErr
    return 'update'
  }

  const { error: insErr } = await sb.from('alwayson_metas_distribuidor').insert(payload)
  if (insErr) throw insErr
  return 'insert'
}

/**
 * Propaga metas bottom-up: vendedor → supervisor → gerente → distribuidor.
 * Cada nível recebe a soma das metas dos filhos diretos (mesmo tipo/período),
 * alinhado ao rollup da view alwayson_metas_v_acompanhamento (migration 045).
 */
async function gerarRollups(sb, { periodoInicio, periodoFim, tipo, observacao, dryRun }) {
  const { data: metasBase, error: metasErr } = await sb
    .from('alwayson_metas_distribuidor')
    .select('distribuidor_id, vendedor_id, hierarquia, valor_meta')
    .eq('tipo', tipo)
    .eq('periodo_inicio', periodoInicio)
    .eq('periodo_fim', periodoFim)
    .eq('hierarquia', 'vendedor')
  if (metasErr) throw metasErr

  const { data: vendedores, error: vendErr } = await sb
    .from('alwayson_vendedores_distribuidor')
    .select('id, distribuidor_id, tipo, supervisor_id')
  if (vendErr) throw vendErr

  const metaPorVendedor = new Map(
    (metasBase ?? []).map((m) => [m.vendedor_id, Number(m.valor_meta ?? 0)])
  )
  const porId = new Map((vendedores ?? []).map((v) => [v.id, v]))

  const supervisores = (vendedores ?? []).filter((v) => v.tipo === 'supervisor')
  const gerentes = (vendedores ?? []).filter((v) => v.tipo === 'gerente')
  const distribuidores = [
    ...new Set((metasBase ?? []).map((m) => m.distribuidor_id)),
  ]

  const rollupSupervisor = supervisores.map((sup) => {
    const filhos = (vendedores ?? []).filter(
      (v) => v.tipo === 'vendedor' && v.supervisor_id === sup.id
    )
    const valor = filhos.reduce((s, f) => s + (metaPorVendedor.get(f.id) ?? 0), 0)
    return {
      distribuidor_id: sup.distribuidor_id,
      vendedor_id: sup.id,
      hierarquia: 'supervisor',
      tipo,
      periodo_inicio: periodoInicio,
      periodo_fim: periodoFim,
      valor_meta: Math.round(valor * 100) / 100,
      observacao,
      _filhos: filhos.length,
    }
  })

  const metaPorSupervisor = new Map(
    rollupSupervisor.map((m) => [m.vendedor_id, m.valor_meta])
  )

  const rollupGerente = gerentes.map((ger) => {
    const filhos = supervisores.filter((s) => s.supervisor_id === ger.id)
    const valor = filhos.reduce((s, f) => s + (metaPorSupervisor.get(f.id) ?? 0), 0)
    return {
      distribuidor_id: ger.distribuidor_id,
      vendedor_id: ger.id,
      hierarquia: 'gerente',
      tipo,
      periodo_inicio: periodoInicio,
      periodo_fim: periodoFim,
      valor_meta: Math.round(valor * 100) / 100,
      observacao,
      _filhos: filhos.length,
    }
  })

  const metaPorGerente = new Map(rollupGerente.map((m) => [m.vendedor_id, m.valor_meta]))

  const rollupDistribuidor = distribuidores.map((distId) => {
    const filhos = gerentes.filter(
      (g) => g.distribuidor_id === distId && g.supervisor_id == null
    )
    const valor = filhos.reduce((s, f) => s + (metaPorGerente.get(f.id) ?? 0), 0)
    return {
      distribuidor_id: distId,
      vendedor_id: null,
      hierarquia: 'distribuidor',
      tipo,
      periodo_inicio: periodoInicio,
      periodo_fim: periodoFim,
      valor_meta: Math.round(valor * 100) / 100,
      observacao,
      _filhos: filhos.length,
    }
  })

  const rollups = [...rollupSupervisor, ...rollupGerente, ...rollupDistribuidor]

  console.log(`\nRoll-up (${tipo}, ${periodoInicio} – ${periodoFim}):`)
  console.log(`  · ${rollupSupervisor.length} supervisor(es)`)
  console.log(`  · ${rollupGerente.length} gerente(s)`)
  console.log(`  · ${rollupDistribuidor.length} distribuidor(es)`)

  if (dryRun) {
    for (const r of rollups.slice(0, 6)) {
      const nome =
        r.vendedor_id == null
          ? 'distribuidor'
          : (porId.get(r.vendedor_id)?.tipo ?? '?') + ' ' + r.vendedor_id.slice(0, 8)
      console.log(`  ${r.hierarquia} ${nome}… R$ ${r.valor_meta} (${r._filhos} filhos)`)
    }
    return 0
  }

  let ok = 0
  for (const { _filhos, ...payload } of rollups) {
    if (payload.valor_meta <= 0 && payload.hierarquia !== 'distribuidor') continue
    await upsertMeta(sb, payload)
    ok += 1
  }
  return ok
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const rollupOnly = process.argv.includes('--rollup-only')
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (.env.local).')
    process.exit(1)
  }

  const sb = createClient(url, key)

  if (rollupOnly) {
    const n = await gerarRollups(sb, {
      periodoInicio: PERIODO_INICIO,
      periodoFim: PERIODO_FIM,
      tipo: 'faturamento',
      observacao: OBS + ' Roll-up automático dos filhos diretos.',
      dryRun,
    })
    if (!dryRun) console.log(`\nRoll-up concluído: ${n} meta(s) gravada(s).`)
    return
  }

  const { data: linhas, error } = await sb
    .from('alwayson_faturamento')
    .select('distribuidor_id, vendedor_id, valor_total')
    .gte('data_emissao', PERIODO_INICIO)
    .lte('data_emissao', PERIODO_FIM)

  if (error) throw error

  const porVendedor = new Map()
  for (const row of linhas ?? []) {
    if (!row.vendedor_id) continue
    const chave = row.vendedor_id
    const atual = porVendedor.get(chave) ?? {
      distribuidor_id: row.distribuidor_id,
      vendedor_id: row.vendedor_id,
      realizado: 0,
    }
    atual.realizado += Number(row.valor_total ?? 0)
    porVendedor.set(chave, atual)
  }

  const ordenados = [...porVendedor.values()].sort((a, b) =>
    a.vendedor_id.localeCompare(b.vendedor_id)
  )

  const payloads = ordenados.map((v, idx) => {
    const fator = idx % 2 === 0 ? 1.1 : 0.88
    return {
      distribuidor_id: v.distribuidor_id,
      vendedor_id: v.vendedor_id,
      hierarquia: 'vendedor',
      tipo: 'faturamento',
      periodo_inicio: PERIODO_INICIO,
      periodo_fim: PERIODO_FIM,
      valor_meta: Math.round(v.realizado * fator * 100) / 100,
      observacao: OBS,
    }
  })

  console.log(`Vendedores com faturamento em mai/2026: ${payloads.length}`)
  const acima = payloads.filter((_, i) => i % 2 === 0).length
  const abaixo = payloads.length - acima
  console.log(`  · meta acima do realizado (simula atingir): ${acima}`)
  console.log(`  · meta abaixo do realizado (simula não atingir): ${abaixo}`)

  if (dryRun) {
    console.log('\nDry-run — primeiras 5 linhas:')
    for (const p of payloads.slice(0, 5)) {
      console.log(`  vendedor ${p.vendedor_id.slice(0, 8)}… meta R$ ${p.valor_meta}`)
    }
    await gerarRollups(sb, {
      periodoInicio: PERIODO_INICIO,
      periodoFim: PERIODO_FIM,
      tipo: 'faturamento',
      observacao: OBS,
      dryRun: true,
    })
    return
  }

  let ok = 0
  for (const p of payloads) {
    await upsertMeta(sb, p)
    ok += 1
  }

  console.log(`\nVendedores: ${ok} meta(s) gravada(s) para ${PERIODO_INICIO} – ${PERIODO_FIM}.`)

  const rollupOk = await gerarRollups(sb, {
    periodoInicio: PERIODO_INICIO,
    periodoFim: PERIODO_FIM,
    tipo: 'faturamento',
    observacao: OBS + ' Roll-up automático dos filhos diretos.',
    dryRun: false,
  })
  console.log(`Roll-up: ${rollupOk} meta(s) de supervisor/gerente/distribuidor gravada(s).`)
}

await main().catch((err) => {
  console.error(err.message ?? err)
  process.exit(1)
})
