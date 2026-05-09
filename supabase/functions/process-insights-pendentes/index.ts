import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.99.1'
import {
  buildInsightsClienteUpsertPayload,
  CLIENTE_BRASIL_STATUS,
  enrichCnpjGeo,
  normalizeCnpjDigits,
} from './logic.ts'

/** Estados que podem voltar para `processing` no reprocessamento unitário (fora da fila só-pending). */
const CLAIM_SINGLE_REPROCESS_STATUSES = [
  CLIENTE_BRASIL_STATUS.PENDING,
  CLIENTE_BRASIL_STATUS.PROCESSING,
  CLIENTE_BRASIL_STATUS.ERROR,
  CLIENTE_BRASIL_STATUS.NOT_FOUND,
] as const

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 35

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function processOne(
  sb: SupabaseClient,
  prev: Record<string, unknown>,
  opts: { useNominatim: boolean; claimIn: readonly string[] },
): Promise<'ok' | 'skip' | 'fail'> {
  const cnpj14 = String(prev.cnpj_14 ?? '')
  if (cnpj14.length !== 14) return 'skip'

  const { data: claimed, error: eClaim } = await sb
    .from('alwayson_insights_clientes')
    .update({ brasil_enriquecimento_status: CLIENTE_BRASIL_STATUS.PROCESSING })
    .eq('cnpj_14', cnpj14)
    .in('brasil_enriquecimento_status', [...opts.claimIn])
    .select('cnpj_14')

  if (eClaim) {
    console.error('CAS processing falhou', cnpj14, eClaim.message)
    return 'fail'
  }
  if (!claimed?.length) {
    return 'skip'
  }

  const { data: freshRow, error: eRead } = await sb
    .from('alwayson_insights_clientes')
    .select('*')
    .eq('cnpj_14', cnpj14)
    .maybeSingle()
  if (eRead || !freshRow) {
    console.error('Releitura após claim falhou', cnpj14)
    return 'fail'
  }
  prev = freshRow as Record<string, unknown>

  const geoR = await enrichCnpjGeo(cnpj14, {
    useNominatim: opts.useNominatim,
    brasilDelayMs: 750,
  })

  const header = {
    razao: prev.razao_social != null ? String(prev.razao_social) : null,
    nome_cliente: prev.nome_cliente != null ? String(prev.nome_cliente) : null,
  }

  const upsert = buildInsightsClienteUpsertPayload(cnpj14, header, prev, geoR, {
    geoImport: true,
    brasilAttemptedForCnpj: true,
  })

  const { error: eUp } = await sb.from('alwayson_insights_clientes').upsert(upsert, {
    onConflict: 'cnpj_14',
  })
  if (eUp) {
    console.error('Upsert falhou', cnpj14, eUp.message)
    return 'fail'
  }
  return 'ok'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

  if (!supabaseUrl || !anonKey || !serviceKey) {
    return jsonResponse({ ok: false, error: 'server_misconfigured' }, 500)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResponse({ ok: false, error: 'missing_auth' }, 401)
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: isAdmin, error: adminErr } = await userClient.rpc('current_user_is_admin')
  if (adminErr) {
    console.error('current_user_is_admin:', adminErr.message)
    return jsonResponse({ ok: false, error: 'admin_check_failed' }, 500)
  }
  if (!isAdmin) {
    return jsonResponse({ ok: false, error: 'forbidden' }, 403)
  }

  /** Service role bypassa RLS (necessário para updates na dimensão). */
  const adminSb = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  let body: Record<string, unknown> = {}
  try {
    const t = await req.text()
    if (t.trim()) body = JSON.parse(t) as Record<string, unknown>
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_json' }, 400)
  }

  const use_nominatim = Boolean(body.use_nominatim)

  const singleRaw =
    typeof body.cnpj_14 === 'string'
      ? body.cnpj_14
      : typeof body.only_cnpj === 'string'
        ? body.only_cnpj
        : ''
  const singleCnpj = normalizeCnpjDigits(singleRaw)

  if (singleCnpj.length === 14) {
    const { data: row, error: rowErr } = await adminSb
      .from('alwayson_insights_clientes')
      .select('*')
      .eq('cnpj_14', singleCnpj)
      .maybeSingle()
    if (rowErr || !row) {
      return jsonResponse({
        ok: false,
        error: 'cnpj_not_found',
        message: 'CNPJ não encontrado na dimensão Insights.',
      })
    }

    const stNow = String(
      (row as { brasil_enriquecimento_status?: string }).brasil_enriquecimento_status ?? '',
    )
    if (stNow === CLIENTE_BRASIL_STATUS.READY) {
      const { count: pendingAfterReady } = await adminSb
        .from('alwayson_insights_clientes')
        .select('cnpj_14', { count: 'exact', head: true })
        .eq('brasil_enriquecimento_status', CLIENTE_BRASIL_STATUS.PENDING)
      return jsonResponse({
        ok: true,
        mode: 'single',
        processed: 0,
        skipped: 1,
        failed: 0,
        cnpj_14: singleCnpj,
        pending_remaining: pendingAfterReady ?? undefined,
        message: 'Cliente já está com consulta BrasilAPI concluída (ready).',
      })
    }

    const outcome = await processOne(adminSb, row as Record<string, unknown>, {
      useNominatim: use_nominatim,
      claimIn: CLAIM_SINGLE_REPROCESS_STATUSES,
    })
    const processed = outcome === 'ok' ? 1 : 0
    const skipped = outcome === 'skip' ? 1 : 0
    const failed = outcome === 'fail' ? 1 : 0

    const { count: pendingAfterSingle } = await adminSb
      .from('alwayson_insights_clientes')
      .select('cnpj_14', { count: 'exact', head: true })
      .eq('brasil_enriquecimento_status', CLIENTE_BRASIL_STATUS.PENDING)

    let message: string | undefined
    if (outcome === 'ok') message = 'Consulta BrasilAPI concluída para este CNPJ.'
    else if (outcome === 'skip') {
      message = 'Não foi possível reservar o registro (estado já alterado).'
    } else message = 'Falha ao processar este CNPJ.'

    return jsonResponse({
      ok: true,
      mode: 'single',
      processed,
      skipped,
      failed,
      cnpj_14: singleCnpj,
      pending_remaining: pendingAfterSingle ?? undefined,
      message,
    })
  }

  const limitRaw = Number(body.limit)
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number.isFinite(limitRaw) ? Math.floor(limitRaw) : DEFAULT_LIMIT),
  )

  let listQuery = adminSb
    .from('alwayson_insights_clientes')
    .select('cnpj_14')
    .eq('brasil_enriquecimento_status', CLIENTE_BRASIL_STATUS.PENDING)
    .order('criado_em', { ascending: true })
    .limit(limit)

  const { data: pendRows, error: pendErr } = await listQuery
  if (pendErr) {
    console.error('Lista pendentes:', pendErr.message)
    return jsonResponse({ ok: false, error: 'list_failed' }, 500)
  }

  const list = (pendRows ?? []).map((r) => String((r as { cnpj_14: string }).cnpj_14)).filter(
    (c) => c.length === 14,
  )

  if (!list.length) {
    return jsonResponse({
      ok: true,
      mode: 'batch',
      processed: 0,
      skipped: 0,
      failed: 0,
      message: 'Nenhum registro pending.',
    })
  }

  let processed = 0
  let skipped = 0
  let failed = 0
  const sampleErrors: string[] = []

  for (let i = 0; i < list.length; i++) {
    const cnpj = list[i]
    const { data: row, error } = await adminSb
      .from('alwayson_insights_clientes')
      .select('*')
      .eq('cnpj_14', cnpj)
      .maybeSingle()
    if (error || !row) {
      failed++
      if (sampleErrors.length < 5) sampleErrors.push(`${cnpj}: leitura`)
      continue
    }
    const r = await processOne(adminSb, row as Record<string, unknown>, {
      useNominatim: use_nominatim,
      claimIn: [CLIENTE_BRASIL_STATUS.PENDING],
    })
    if (r === 'ok') processed++
    else if (r === 'skip') skipped++
    else {
      failed++
      if (sampleErrors.length < 5) sampleErrors.push(`${cnpj}: process`)
    }
  }

  const { count: pendingAfter } = await adminSb
    .from('alwayson_insights_clientes')
    .select('cnpj_14', { count: 'exact', head: true })
    .eq('brasil_enriquecimento_status', CLIENTE_BRASIL_STATUS.PENDING)

  return jsonResponse({
    ok: true,
    mode: 'batch',
    processed,
    skipped,
    failed,
    limit,
    pending_remaining: pendingAfter ?? undefined,
    sample_errors: sampleErrors.length ? sampleErrors : undefined,
  })
})
