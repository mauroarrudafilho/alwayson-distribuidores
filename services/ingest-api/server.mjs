#!/usr/bin/env node
/**
 * API de ingestão de relatórios (vendas / estoque / clientes).
 *
 * Contrato: docs/INGESTAO_API_RAILWAY.md
 *
 * Env:
 *   SUPABASE_URL / VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   PORT (default 8787)
 *   CORS_ORIGIN (default *)
 *
 * Uso local:
 *   npm run ingest:api
 */

import cors from 'cors'
import express from 'express'
import multer from 'multer'
import { createClient } from '@supabase/supabase-js'

import { loadDotenv } from './lib/dotenv.mjs'
import { processClientes } from './lib/process-clientes.mjs'
import { processEstoque } from './lib/process-estoque.mjs'
import { processVendas } from './lib/process-vendas.mjs'

loadDotenv()

const PORT = Number(process.env.PORT || 8787)
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    'Faltam SUPABASE_URL (ou VITE_SUPABASE_URL) e SUPABASE_SERVICE_ROLE_KEY no .env.local'
  )
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
})

const app = express()
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || true,
  })
)
app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'alwayson-ingest-api' })
})

app.post('/api/ingest', upload.single('file'), async (req, res) => {
  const tipo = String(req.body?.tipo ?? '').trim()
  const distribuidorId = String(req.body?.distribuidor_id ?? '').trim()
  const periodoReferencia = String(req.body?.periodo_referencia ?? '').trim()
  const file = req.file

  if (!['vendas', 'estoque', 'clientes'].includes(tipo)) {
    return res.status(400).json({
      error: 'tipo_invalido',
      message: 'Tipo deve ser vendas, estoque ou clientes.',
    })
  }
  if (!distribuidorId || !periodoReferencia) {
    return res.status(400).json({
      error: 'campos_obrigatorios',
      message: 'distribuidor_id e periodo_referencia são obrigatórios.',
    })
  }
  if (!file?.buffer?.length) {
    return res.status(400).json({
      error: 'arquivo_ausente',
      message: 'Envie o arquivo no campo file.',
    })
  }

  const { data: dist, error: distErr } = await supabase
    .from('alwayson_distribuidores')
    .select('id')
    .eq('id', distribuidorId)
    .maybeSingle()
  if (distErr) {
    console.error(distErr)
    return res.status(500).json({ error: 'internal_error', message: distErr.message })
  }
  if (!dist) {
    return res.status(400).json({
      error: 'distribuidor_invalido',
      message: 'Distribuidor não encontrado.',
    })
  }

  const { data: ingestRow, error: ingestInsErr } = await supabase
    .from('alwayson_relatorios_ingestao')
    .insert({
      distribuidor_id: distribuidorId,
      tipo,
      arquivo_nome: file.originalname || 'upload.bin',
      status: 'processando',
      periodo_referencia: periodoReferencia,
    })
    .select('id')
    .single()

  if (ingestInsErr) {
    console.error(ingestInsErr)
    return res.status(500).json({ error: 'internal_error', message: ingestInsErr.message })
  }

  const ingestId = ingestRow.id

  try {
    let result
    if (tipo === 'vendas') {
      result = await processVendas(supabase, {
        buffer: file.buffer,
        distribuidorId,
        arquivoNome: file.originalname,
      })
    } else if (tipo === 'estoque') {
      result = await processEstoque(supabase, {
        buffer: file.buffer,
        distribuidorId,
      })
    } else {
      result = await processClientes(supabase, {
        buffer: file.buffer,
        distribuidorId,
      })
    }

    await supabase
      .from('alwayson_relatorios_ingestao')
      .update({
        status: 'concluido',
        registros_processados: result.registros_processados,
        erros: result.detalhes?.avisos?.length ? { avisos: result.detalhes.avisos } : null,
      })
      .eq('id', ingestId)

    return res.status(200).json({
      id: ingestId,
      status: 'concluido',
      registros_processados: result.registros_processados,
      message: 'Processamento concluído com sucesso.',
      detalhes: result.detalhes,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao processar arquivo.'
    const code = err?.code || 'internal_error'
    const status = err?.status || 500
    const erros = err?.erros

    console.error('[ingest]', ingestId, message)

    await supabase
      .from('alwayson_relatorios_ingestao')
      .update({
        status: 'erro',
        erros: { message, code, erros: erros ?? null },
      })
      .eq('id', ingestId)

    return res.status(status).json({
      id: ingestId,
      error: code,
      message,
      erros: erros ?? undefined,
    })
  }
})

app.get('/api/ingest/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('alwayson_relatorios_ingestao')
    .select('*')
    .eq('id', req.params.id)
    .maybeSingle()
  if (error) {
    return res.status(500).json({ error: 'internal_error', message: error.message })
  }
  if (!data) {
    return res.status(404).json({ error: 'not_found', message: 'Ingestão não encontrada.' })
  }
  return res.json(data)
})

app.listen(PORT, () => {
  console.log(`alwayson-ingest-api listening on http://localhost:${PORT}`)
})
