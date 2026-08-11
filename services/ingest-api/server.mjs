#!/usr/bin/env node
/**
 * API de ingestão de relatórios (vendas / estoque / clientes).
 *
 * Contrato: docs/INGESTAO_API_RAILWAY.md
 *
 * Env:
 *   SUPABASE_URL / VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   SUPABASE_ANON_KEY / VITE_SUPABASE_ANON_KEY  — valida o JWT de quem chama
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
const ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
  console.error(
    'Faltam SUPABASE_URL (ou VITE_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY e SUPABASE_ANON_KEY no .env.local'
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

/**
 * Client no contexto de quem chamou (anon key + JWT da sessão), para que
 * `auth.uid()` resolva dentro das funções de escopo. O client `supabase` deste
 * módulo usa service_role e passa por cima de todo o RLS — por isso ele nunca
 * decide *se* pode, só executa depois da decisão.
 */
function clientDoChamador(token) {
  return createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function tokenDoHeader(req) {
  const [scheme, valor] = String(req.headers.authorization ?? '').split(' ')
  if (scheme?.toLowerCase() !== 'bearer') return null
  return valor?.trim() || null
}

/**
 * Roda antes do multer: quem não se identifica é recusado sem que o arquivo
 * chegue a ser bufferizado.
 */
async function autenticar(req, res, next) {
  const token = tokenDoHeader(req)
  if (!token) {
    return res.status(401).json({
      error: 'nao_autenticado',
      message: 'Envie o access_token da sessão no header Authorization.',
    })
  }

  const client = clientDoChamador(token)
  const { data, error } = await client.auth.getUser()
  if (error || !data?.user) {
    return res.status(401).json({
      error: 'sessao_invalida',
      message: 'Sessão inválida ou expirada. Entre novamente e repita o envio.',
    })
  }

  req.usuario = data.user
  req.clientDoChamador = client
  return next()
}

/**
 * Autoriza o par (distribuidor, fornecedor) pelas mesmas funções que governam
 * o SELECT no Postgres (migrations 048/049): admin global passa em tudo; os
 * demais precisam alcançar os dois eixos — é o "E" do KAM, aplicado à escrita.
 */
async function podeIngerir(client, { distribuidorId, fornecedorId }) {
  const { data: admin, error: adminErr } = await client.rpc('current_user_is_admin')
  if (adminErr) throw adminErr
  if (admin === true) return true

  const [distRes, fornRes] = await Promise.all([
    client.rpc('current_user_distribuidores_visiveis'),
    client.rpc('current_user_fornecedores_visiveis'),
  ])
  if (distRes.error) throw distRes.error
  if (fornRes.error) throw fornRes.error

  const alcancaDistribuidor = (distRes.data ?? []).some((r) => r.distribuidor_id === distribuidorId)
  const alcancaFornecedor = (fornRes.data ?? []).some((r) => r.tenant_id === fornecedorId)
  return alcancaDistribuidor && alcancaFornecedor
}

app.post('/api/ingest', autenticar, upload.single('file'), async (req, res) => {
  const tipo = String(req.body?.tipo ?? '').trim()
  const distribuidorId = String(req.body?.distribuidor_id ?? '').trim()
  const fornecedorId = String(req.body?.fornecedor_id ?? '').trim()
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
  // O arquivo é sempre o recorte de um fornecedor dentro de um distribuidor
  // (migration 047) — sem o carimbo não há como o fornecedor ver "o que é dele".
  if (!fornecedorId) {
    return res.status(400).json({
      error: 'campos_obrigatorios',
      message: 'fornecedor_id é obrigatório.',
    })
  }
  if (!file?.buffer?.length) {
    return res.status(400).json({
      error: 'arquivo_ausente',
      message: 'Envie o arquivo no campo file.',
    })
  }

  let autorizado
  try {
    autorizado = await podeIngerir(req.clientDoChamador, { distribuidorId, fornecedorId })
  } catch (err) {
    console.error('[ingest] escopo', err)
    return res.status(500).json({
      error: 'internal_error',
      message: 'Não foi possível verificar o seu acesso.',
    })
  }
  if (!autorizado) {
    // Mesma resposta para "não alcança" e "não existe": quem não tem acesso ao
    // par não deve descobrir por tentativa quais pares existem.
    return res.status(403).json({
      error: 'sem_acesso',
      message: 'Você não tem acesso a este distribuidor/fornecedor.',
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

  // Exige a relação comercial cadastrada, não só que o tenant exista: carimbar
  // um fornecedor que não atende aquele distribuidor produziria dado que
  // ninguém consegue enxergar depois que o escopo de acesso entrar.
  const { data: vinculo, error: vinculoErr } = await supabase
    .from('alwayson_fornecedor_distribuidores')
    .select('id')
    .eq('fornecedor_tenant_id', fornecedorId)
    .eq('distribuidor_id', distribuidorId)
    .eq('ativo', true)
    .maybeSingle()
  if (vinculoErr) {
    console.error(vinculoErr)
    return res.status(500).json({ error: 'internal_error', message: vinculoErr.message })
  }
  if (!vinculo) {
    return res.status(400).json({
      error: 'fornecedor_invalido',
      message: 'Fornecedor não vinculado a este distribuidor.',
    })
  }

  const { data: ingestRow, error: ingestInsErr } = await supabase
    .from('alwayson_relatorios_ingestao')
    .insert({
      distribuidor_id: distribuidorId,
      fornecedor_tenant_id: fornecedorId,
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
        fornecedorTenantId: fornecedorId,
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
