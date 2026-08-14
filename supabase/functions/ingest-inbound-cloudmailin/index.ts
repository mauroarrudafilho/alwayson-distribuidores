import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.99.1'

/**
 * ingest-inbound-cloudmailin — Canal 1 do Pacote G: recebe o POST do CloudMailin
 * (JSON normalizado), resolve o endereço para o par (distribuidor, fornecedor)
 * na config de recebimento e chama a API de ingestão (Railway) com o anexo.
 *
 * Segurança:
 *  - Auth do próprio CloudMailin: Basic Auth (credenciais embutidas na URL-alvo
 *    que o CloudMailin usa). Conferir contra CLOUDMAILIN_USER/CLOUDMAILIN_PASS.
 *  - A chamada à API de ingestão usa INGEST_INTERNAL_SECRET — o webhook é máquina
 *    nossa; o par é validado na config de recebimento (nunca passa pelo service_role).
 *
 * Env:
 *   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
 *   CLOUDMAILIN_USER / CLOUDMAILIN_PASS
 *   INGEST_API_URL        (ex.: https://alwayson-ingest-api-production.up.railway.app)
 *   INGEST_INTERNAL_SECRET
 *
 * Deploy (verify_jwt=false — o CloudMailin não envia JWT da app):
 *   supabase functions deploy ingest-inbound-cloudmailin --project-ref osukbalwykbqvoumddxz --no-verify-jwt
 */

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-ingest-internal-secret',
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/** Sanitiza nome de arquivo para um path de storage seguro. */
function sanitizeName(name: string): string {
  const base = name.replace(/[^\w.\-]+/g, '_').replace(/^_+|_+$/g, '')
  return (base || 'anexo').slice(0, 120)
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/** Procura `YYYY-MM` (ou `MM-YYYY`) em subject/nome/corpo. Fallback: mês corrente. */
function inferPeriodo(...refs: (string | undefined)[]): string {
  const hoje = new Date()
  const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
  for (const r of refs) {
    if (!r) continue
    const m1 = /\b(20\d{2})[-_.\s/](0[1-9]|1[0-2])\b/.exec(r)
    if (m1) return `${m1[1]}-${m1[2]}`
    const m2 = /\b(0[1-9]|1[0-2])[-_.\s/](20\d{2})\b/.exec(r)
    if (m2) return `${m2[2]}-${m2[1]}`
  }
  return mesAtual
}

function monthEnd(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return `${ym}-${String(last).padStart(2, '0')}`
}

/** Infere o tipo do relatório por palavra-chave, restrito aos tipos esperados da config. */
function inferTipo(opts: {
  fileName: string
  subject: string
  plain: string
  esperados: string[]
}): string {
  const hay = `${opts.fileName} ${opts.subject} ${opts.plain}`.toLowerCase()
  const regras: Record<string, string> = {
    cliente: 'clientes',
    estoque: 'estoque',
    venda: 'vendas',
    faturamento: 'vendas',
    'mix de produtos': 'vendas',
  }
  for (const [kw, tipo] of Object.entries(regras)) {
    if (hay.includes(kw) && opts.esperados.includes(tipo)) return tipo
  }
  if (opts.esperados.length === 1) return opts.esperados[0]
  return 'vendas'
}

interface RecebimentoConfig {
  distribuidor_id: string
  fornecedor_tenant_id: string
  tipos_esperados: string[]
  ativo: boolean
  modo_validacao: boolean
}

interface CloudmailinAttachment {
  file_name?: string
  content_type?: string
  content?: string
  url?: string
  disposition?: string
  size?: number
}

function isExpectedBasic(authHeader: string | null): boolean {
  const user = Deno.env.get('CLOUDMAILIN_USER') ?? ''
  const pass = Deno.env.get('CLOUDMAILIN_PASS') ?? ''
  if (!user || !pass) return false
  const expected = 'Basic ' + btoa(`${user}:${pass}`)
  return authHeader === expected
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const ingestUrl = Deno.env.get('INGEST_API_URL') ?? ''
  const ingestSecret = Deno.env.get('INGEST_INTERNAL_SECRET') ?? ''

  if (!supabaseUrl || !serviceKey || !ingestUrl || !ingestSecret) {
    return jsonResponse({ ok: false, error: 'server_misconfigured' }, 500)
  }

  // CloudMailin usa Basic Auth na URL-alvo — única prova de que o POST é dele.
  if (!isExpectedBasic(req.headers.get('authorization'))) {
    return jsonResponse({ ok: false, error: 'unauthorized' }, 401)
  }

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_json' }, 400)
  }

  const envelope = (body.envelope ?? {}) as Record<string, unknown>
  const headers = (body.headers ?? {}) as Record<string, unknown>
  const to = String(envelope.to ?? headers.to ?? '').trim().toLowerCase()

  const sb = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: cfg, error: cfgErr } = await sb
    .from('alwayson_distribuidor_recebimento')
    .select('distribuidor_id, fornecedor_tenant_id, tipos_esperados, ativo, modo_validacao')
    .eq('email_recebimento', to)
    .maybeSingle()

  if (cfgErr) {
    console.error('[inbound] config lookup falhou', cfgErr.message)
    return jsonResponse({ ok: false, error: 'config_lookup_failed' }, 500)
  }
  if (!cfg || !cfg.ativo) {
    // 200 de propósito: endereço desconhecido não deve gerar retry do CloudMailin.
    console.warn('[inbound] endereço sem config ativa:', to)
    return jsonResponse({ ok: true, handled: false, reason: 'recipient_unconfigured' })
  }
  const conf = cfg as unknown as RecebimentoConfig

  const attachments = (body.attachments ?? []) as CloudmailinAttachment[]
  const anexo = attachments.find(
    (a) => a.disposition === 'attachment' || Boolean(a.content || a.url)
  ) ?? attachments[0]
  if (!anexo || (!anexo.content && !anexo.url)) {
    console.warn('[inbound] e-mail sem anexo:', to)
    return jsonResponse({ ok: true, handled: false, reason: 'no_attachment' })
  }

  let bytes: Uint8Array
  if (anexo.content) {
    bytes = base64ToBytes(anexo.content)
  } else {
    const resp = await fetch(anexo.url!)
    if (!resp.ok) {
      console.error('[inbound] falha ao baixar anexo de', anexo.url)
      return jsonResponse({ ok: false, error: 'attachment_fetch_failed' }, 502)
    }
    bytes = new Uint8Array(await resp.arrayBuffer())
  }
  if (!bytes.length) {
    return jsonResponse({ ok: true, handled: false, reason: 'empty_attachment' })
  }

  const fileName = sanitizeName(anexo.file_name ?? 'anexo.bin')
  const tipo = inferTipo({
    fileName,
    subject: String(headers.subject ?? ''),
    plain: String(body.plain ?? ''),
    esperados: conf.tipos_esperados,
  })
  const periodo = monthEnd(
    inferPeriodo(String(headers.subject ?? ''), fileName, String(body.plain ?? ''))
  )

  // Guarda o arquivo bruto (auditoria / reprocesso sem re-envio do e-mail).
  const storagePath = `${conf.distribuidor_id}/${Date.now()}-${fileName}`
  const { error: upErr } = await sb.storage
    .from('ingest-inbox')
    .upload(storagePath, bytes, { contentType: anexo.content_type ?? 'application/octet-stream' })
  if (upErr) {
    console.error('[inbound] storage falhou', storagePath, upErr.message)
    return jsonResponse({ ok: false, error: 'storage_failed' }, 500)
  }

  const form = new FormData()
  form.append('tipo', tipo)
  form.append('distribuidor_id', conf.distribuidor_id)
  form.append('fornecedor_id', conf.fornecedor_tenant_id)
  form.append('periodo_referencia', periodo)
  form.append('file', new Blob([bytes as BlobPart], { type: anexo.content_type }), fileName)

  try {
    const ingestResp = await fetch(`${ingestUrl}/api/ingest`, {
      method: 'POST',
      headers: { 'x-ingest-internal-secret': ingestSecret },
      body: form,
    })
    const text = await ingestResp.text()
    let ingestBody: Record<string, unknown> = {}
    try {
      ingestBody = text ? JSON.parse(text) : {}
    } catch {
      ingestBody = { raw: text }
    }
    const ok = ingestResp.ok && ingestBody.status !== 'erro'
    return jsonResponse(
      {
        ok,
        handled: true,
        tipo,
        periodo_referencia: periodo,
        modo_validacao: conf.modo_validacao,
        storage_path: storagePath,
        ingest: ingestBody,
      },
      ok ? 200 : 502
    )
  } catch (err) {
    console.error('[inbound] ingest API falhou', err instanceof Error ? err.message : err)
    return jsonResponse({ ok: false, error: 'ingest_api_failed' }, 502)
  }
})
