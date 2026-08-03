#!/usr/bin/env node
/**
 * API do pipeline PDV (Explorar) — Railway.
 *
 * Contrato: docs/PDV_PIPELINE_RAILWAY.md
 *
 * Env:
 *   SUPABASE_URL / VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   PDV_PIPELINE_SECRET   — header X-Pipeline-Secret nos disparos
 *   RECEITA_DATA_DIR      — pasta com CSVs extraídos (volume Railway ou S3)
 *   PORT (default 8788)
 *
 * Uso local:
 *   npm run pdv:api
 */

import cors from 'cors'
import express from 'express'

import { assertPipelineSecret } from './lib/auth.mjs'
import { loadDotenv } from './lib/dotenv.mjs'
import {
  ETAPAS,
  concluirExecucao,
  criarExecucao,
  falharExecucao,
  obterExecucao,
} from './lib/execucoes.mjs'
import { createServiceClient } from './lib/supabase.mjs'
import { runReceitaUniverso } from './jobs/receita-universo.mjs'
import { runGeocodeCnefe } from './jobs/geocode-cnefe.mjs'
import { runScoreModelo } from './jobs/score-modelo.mjs'
import { runCruzamento } from './jobs/cruzamento.mjs'
import { runCobertura } from './jobs/cobertura.mjs'
import { parseCodigosIbge, PILOTO_PETROLINA } from './lib/piloto.mjs'

loadDotenv()

const PORT = Number(process.env.PORT || 8788)
const supabase = createServiceClient()

const app = express()
app.use(cors({ origin: process.env.CORS_ORIGIN || true }))
app.use(express.json({ limit: '1mb' }))

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'alwayson-pdv-pipeline', etapas: Object.values(ETAPAS) })
})

/** Dispara etapa 1 (Receita → universo). Resposta imediata; job corre em background. */
app.post('/api/pdv/receita-universo', async (req, res) => {
  if (!assertPipelineSecret(req, res)) return

  const uf = String(req.body?.uf ?? 'PE').toUpperCase()
  const dataDir = String(req.body?.data_dir ?? process.env.RECEITA_DATA_DIR ?? '').trim()
  const limit = req.body?.limit != null ? Number(req.body.limit) : 0
  const dryRun = Boolean(req.body?.dry_run)
  const codigosIbge = parseCodigosIbge(
    Array.isArray(req.body?.codigo_ibge)
      ? req.body.codigo_ibge.map(String)
      : req.body?.codigo_ibge != null
        ? [String(req.body.codigo_ibge)]
        : req.body?.piloto === 'petrolina'
          ? [String(PILOTO_PETROLINA.codigo_ibge)]
          : []
  )
  const ufFinal =
    req.body?.piloto === 'petrolina' ? PILOTO_PETROLINA.uf : uf

  if (!dataDir && !dryRun) {
    return res.status(400).json({
      error: 'data_dir_ausente',
      message: 'Informe data_dir no body ou RECEITA_DATA_DIR no serviço.',
    })
  }

  let execId
  try {
    execId = await criarExecucao(supabase, ETAPAS.receita_universo, {
      uf: ufFinal,
      data_dir: dataDir,
      limit: limit || null,
      codigos_ibge: codigosIbge.length ? codigosIbge : null,
      dry_run: dryRun,
      origem: 'api',
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'internal_error', message: err.message })
  }

  res.status(202).json({
    id: execId,
    status: 'processando',
    etapa: ETAPAS.receita_universo,
    message: 'Job aceito. Consulte GET /api/pdv/jobs/:id',
  })

  runReceitaUniverso({
    uf: ufFinal,
    dataDir,
    dryRun,
    limit,
    codigosIbge,
    execId,
    gerenciaAuditoria: false,
  })
    .then((resultado) => concluirExecucao(supabase, execId, resultado))
    .catch(async (err) => {
      console.error('[pdv-pipeline]', execId, err)
      await falharExecucao(supabase, execId, err)
    })
})

/** Etapa CNEFE — geocode universo. */
app.post('/api/pdv/geocode-cnefe', async (req, res) => {
  if (!assertPipelineSecret(req, res)) return

  const dataDir = String(req.body?.data_dir ?? process.env.CNEFE_DATA_DIR ?? './data/cnefe').trim()
  const dryRun = Boolean(req.body?.dry_run)
  const codigosIbge = parseCodigosIbge(
    Array.isArray(req.body?.codigo_ibge)
      ? req.body.codigo_ibge.map(String)
      : req.body?.codigo_ibge != null
        ? [String(req.body.codigo_ibge)]
        : req.body?.piloto === 'petrolina'
          ? [String(PILOTO_PETROLINA.codigo_ibge)]
          : []
  )

  if (!codigosIbge.length) {
    return res.status(400).json({ error: 'codigo_ibge_ausente' })
  }

  let execId
  try {
    execId = await criarExecucao(supabase, ETAPAS.geocode_cnefe, {
      codigos_ibge: codigosIbge,
      data_dir: dataDir,
      dry_run: dryRun,
      origem: 'api',
    })
  } catch (err) {
    return res.status(500).json({ error: 'internal_error', message: err.message })
  }

  res.status(202).json({ id: execId, status: 'processando', etapa: ETAPAS.geocode_cnefe })

  runGeocodeCnefe({
    codigosIbge,
    dataDir,
    municipioSlug: req.body?.piloto === 'petrolina' ? PILOTO_PETROLINA.municipio : 'PETROLINA',
    dryRun,
    execId,
    gerenciaAuditoria: false,
  })
    .then((resultado) => concluirExecucao(supabase, execId, resultado))
    .catch(async (err) => {
      console.error('[pdv-pipeline]', execId, err)
      await falharExecucao(supabase, execId, err)
    })
})

/** Etapa score v0. */
app.post('/api/pdv/score-modelo', async (req, res) => {
  if (!assertPipelineSecret(req, res)) return

  const dryRun = Boolean(req.body?.dry_run)
  const codigosIbge = parseCodigosIbge(
    Array.isArray(req.body?.codigo_ibge)
      ? req.body.codigo_ibge.map(String)
      : req.body?.codigo_ibge != null
        ? [String(req.body.codigo_ibge)]
        : req.body?.piloto === 'petrolina'
          ? [String(PILOTO_PETROLINA.codigo_ibge)]
          : []
  )

  if (!codigosIbge.length) {
    return res.status(400).json({ error: 'codigo_ibge_ausente' })
  }

  let execId
  try {
    execId = await criarExecucao(supabase, ETAPAS.score_modelo, {
      codigos_ibge: codigosIbge,
      dry_run: dryRun,
      origem: 'api',
    })
  } catch (err) {
    return res.status(500).json({ error: 'internal_error', message: err.message })
  }

  res.status(202).json({ id: execId, status: 'processando', etapa: ETAPAS.score_modelo })

  runScoreModelo({ codigosIbge, dryRun, execId, gerenciaAuditoria: false })
    .then((resultado) => concluirExecucao(supabase, execId, resultado))
    .catch(async (err) => {
      console.error('[pdv-pipeline]', execId, err)
      await falharExecucao(supabase, execId, err)
    })
})

function parsePilotoCruzamento(req) {
  const codigosIbge = parseCodigosIbge(
    Array.isArray(req.body?.codigo_ibge)
      ? req.body.codigo_ibge.map(String)
      : req.body?.codigo_ibge != null
        ? [String(req.body.codigo_ibge)]
        : req.body?.piloto === 'petrolina'
          ? [String(PILOTO_PETROLINA.codigo_ibge)]
          : []
  )
  const distribuidorId =
    req.body?.distribuidor_id ??
    (req.body?.piloto === 'petrolina' ? PILOTO_PETROLINA.distribuidor_id : null)
  return { codigosIbge, distribuidorId }
}

/** Cruzamento carteira × potencial. */
app.post('/api/pdv/cruzamento', async (req, res) => {
  if (!assertPipelineSecret(req, res)) return
  const { codigosIbge, distribuidorId } = parsePilotoCruzamento(req)
  if (!codigosIbge.length || !distribuidorId) {
    return res.status(400).json({ error: 'parametros_ausentes' })
  }
  const dryRun = Boolean(req.body?.dry_run)
  let execId
  try {
    execId = await criarExecucao(supabase, ETAPAS.cruzamento, {
      codigos_ibge: codigosIbge,
      distribuidor_id: distribuidorId,
      dry_run: dryRun,
      origem: 'api',
    })
  } catch (err) {
    return res.status(500).json({ error: 'internal_error', message: err.message })
  }
  res.status(202).json({ id: execId, status: 'processando', etapa: ETAPAS.cruzamento })
  runCruzamento({ codigosIbge, distribuidorId, dryRun, execId, gerenciaAuditoria: false })
    .then((r) => concluirExecucao(supabase, execId, r))
    .catch(async (err) => {
      console.error('[pdv-pipeline]', execId, err)
      await falharExecucao(supabase, execId, err)
    })
})

/** Cobertura por microrregião. */
app.post('/api/pdv/cobertura', async (req, res) => {
  if (!assertPipelineSecret(req, res)) return
  const { codigosIbge, distribuidorId } = parsePilotoCruzamento(req)
  if (!codigosIbge.length || !distribuidorId) {
    return res.status(400).json({ error: 'parametros_ausentes' })
  }
  const dryRun = Boolean(req.body?.dry_run)
  let execId
  try {
    execId = await criarExecucao(supabase, ETAPAS.cobertura, {
      codigos_ibge: codigosIbge,
      distribuidor_id: distribuidorId,
      dry_run: dryRun,
      origem: 'api',
    })
  } catch (err) {
    return res.status(500).json({ error: 'internal_error', message: err.message })
  }
  res.status(202).json({ id: execId, status: 'processando', etapa: ETAPAS.cobertura })
  runCobertura({ codigosIbge, distribuidorId, dryRun, execId, gerenciaAuditoria: false })
    .then((r) => concluirExecucao(supabase, execId, r))
    .catch(async (err) => {
      console.error('[pdv-pipeline]', execId, err)
      await falharExecucao(supabase, execId, err)
    })
})

/** Placeholder Google sinal. */
const STUB_ETAPAS = [ETAPAS.google_sinal]

for (const etapa of STUB_ETAPAS) {
  app.post(`/api/pdv/${etapa.replace(/_/g, '-')}`, (req, res) => {
    if (!assertPipelineSecret(req, res)) return
    res.status(501).json({
      error: 'nao_implementado',
      etapa,
      message: 'Etapa reservada — ver ordem de implementação no spec PDV v2.',
    })
  })
}

app.get('/api/pdv/jobs/:id', async (req, res) => {
  if (!assertPipelineSecret(req, res)) return
  try {
    const row = await obterExecucao(supabase, req.params.id)
    if (!row) return res.status(404).json({ error: 'not_found' })
    return res.json(row)
  } catch (err) {
    return res.status(500).json({ error: 'internal_error', message: err.message })
  }
})

app.listen(PORT, () => {
  console.log(`alwayson-pdv-pipeline listening on http://localhost:${PORT}`)
})
