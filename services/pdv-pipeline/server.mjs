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

  if (!dataDir && !dryRun) {
    return res.status(400).json({
      error: 'data_dir_ausente',
      message: 'Informe data_dir no body ou RECEITA_DATA_DIR no serviço.',
    })
  }

  let execId
  try {
    execId = await criarExecucao(supabase, ETAPAS.receita_universo, {
      uf,
      data_dir: dataDir,
      limit: limit || null,
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

  runReceitaUniverso({ uf, dataDir, dryRun, limit, execId, gerenciaAuditoria: false })
    .then((resultado) => concluirExecucao(supabase, execId, resultado))
    .catch(async (err) => {
      console.error('[pdv-pipeline]', execId, err)
      await falharExecucao(supabase, execId, err)
    })
})

/** Placeholders das próximas etapas — implementação incremental. */
const STUB_ETAPAS = [
  ETAPAS.score_modelo,
  ETAPAS.geocode_cnefe,
  ETAPAS.cruzamento,
  ETAPAS.cobertura,
  ETAPAS.google_sinal,
]

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
