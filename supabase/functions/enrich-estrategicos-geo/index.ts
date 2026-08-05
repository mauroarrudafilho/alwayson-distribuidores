/**
 * Worker de geocodificação da lista estratégica.
 *
 * Mesmo desenho de `process-insights-pendentes`, aplicado a
 * `alwayson_clientes_estrategicos`: a fila vive numa coluna de estado
 * (`geo_status`), o claim é CAS, e a consulta externa corre **na infra do
 * Supabase** — não na máquina de quem opera. É por isso que existe: o script
 * local `estrategicos:enrich-geo` só serve onde há saída para a internet.
 *
 * Cascata por CNPJ: BrasilAPI (endereço da Receita) → Nominatim (coordenada).
 * ⚠️ Nada vem do relatório de terceiro que originou a lista — ver PENDENCIAS §5.
 *
 * POST body:
 *   { limit?: number, uf?: string, cnpj?: string, use_nominatim?: boolean,
 *     requeue?: 'error' | 'not_found' | 'processing' }
 */

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.99.1'
import {
  brasilReasonToStatus,
  enrichCnpjGeo,
  normalizeCnpjDigits,
} from '../process-insights-pendentes/logic.ts'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Cada CNPJ custa ~1 chamada BrasilAPI (750ms de folga) + ~1 Nominatim (1,1s de
 * política de uso). O lote é curto de propósito: a Edge Function tem tecto de
 * tempo, e um lote que estoura devolve tudo como falha.
 */
const DEFAULT_LIMIT = 15
const MAX_LIMIT = 30

const STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  READY: 'ready',
  NOT_FOUND: 'not_found',
  ERROR: 'error',
} as const

type Candidato = {
  id: string
  cnpj: string
  cidade: string | null
  estado: string | null
  geo_tentativas: number | null
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function vazio(v: unknown): boolean {
  return v == null || String(v).trim() === ''
}

/**
 * Processa um CNPJ.
 *
 * O claim é o que impede duas abas (ou duas invocações) de gastarem a mesma
 * chamada externa: só quem conseguir mover `pending → processing` trabalha.
 */
async function processarUm(
  sb: SupabaseClient,
  linha: Candidato,
  opts: { useNominatim: boolean; claimIn: readonly string[] },
): Promise<'ok' | 'sem_fonte' | 'skip' | 'fail'> {
  const cnpj = normalizeCnpjDigits(linha.cnpj)
  if (cnpj.length !== 14) return 'skip'

  const { data: claimed, error: eClaim } = await sb
    .from('alwayson_clientes_estrategicos')
    .update({ geo_status: STATUS.PROCESSING })
    .eq('id', linha.id)
    .in('geo_status', [...opts.claimIn])
    .select('id')

  if (eClaim) {
    console.error('claim falhou', cnpj, eClaim.message)
    return 'fail'
  }
  if (!claimed?.length) return 'skip'

  const geo = await enrichCnpjGeo(cnpj, { useNominatim: opts.useNominatim, brasilDelayMs: 750 })

  const patch: Record<string, unknown> = {
    geo_tentativas: (linha.geo_tentativas ?? 0) + 1,
    geo_verificado_em: new Date().toISOString(),
  }

  if (!geo.ok) {
    patch.geo_status = brasilReasonToStatus(geo.reason)
    patch.geo_motivo = geo.reason ?? 'brasil_api'
  } else {
    // Cidade/UF só entram onde a linha ainda está vazia: a carga original já
    // trouxe praça para a maioria, e a Receita não tem de a sobrepor.
    if (vazio(linha.cidade) && geo.cidade) patch.cidade = String(geo.cidade).trim()
    if (vazio(linha.estado) && geo.estado) {
      patch.estado = String(geo.estado).trim().toUpperCase().slice(0, 2)
    }

    if (geo.lat != null && geo.lng != null && Number.isFinite(geo.lat) && Number.isFinite(geo.lng)) {
      patch.lat = geo.lat
      patch.lng = geo.lng
      patch.geo_fonte = 'nominatim'
      patch.geo_atualizado_em = geo.geoTs ?? new Date().toISOString()
      patch.geo_status = STATUS.READY
      patch.geo_motivo = null
    } else {
      // Endereço existe, o geocoder é que não devolveu ponto. Sai da fila para
      // não repetir a chamada em cada lote — volta só por requeue explícito.
      patch.geo_status = STATUS.NOT_FOUND
      patch.geo_motivo = opts.useNominatim ? 'sem_coordenada' : 'nominatim_desligado'
    }
  }

  const { error: eUp } = await sb
    .from('alwayson_clientes_estrategicos')
    .update(patch)
    .eq('id', linha.id)

  if (eUp) {
    console.error('update falhou', cnpj, eUp.message)
    return 'fail'
  }
  return patch.geo_status === STATUS.READY ? 'ok' : 'sem_fonte'
}

async function contadores(sb: SupabaseClient) {
  const { data } = await sb
    .from('alwayson_clientes_estrategicos_v_geo_fila')
    .select('*')
    .maybeSingle()
  return (data ?? null) as Record<string, number> | null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405)

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
  if (!isAdmin) return jsonResponse({ ok: false, error: 'forbidden' }, 403)

  /** Service role bypassa RLS — a linha territorial não tem dono para autorizar. */
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

  const useNominatim = body.use_nominatim === undefined ? true : Boolean(body.use_nominatim)
  const limitRaw = Number(body.limit)
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number.isFinite(limitRaw) ? Math.floor(limitRaw) : DEFAULT_LIMIT),
  )
  const uf = typeof body.uf === 'string' && body.uf.trim() ? body.uf.trim().toUpperCase() : null
  const cnpjUnico = typeof body.cnpj === 'string' ? normalizeCnpjDigits(body.cnpj) : ''

  const requeue = typeof body.requeue === 'string' ? body.requeue : null
  if (requeue) {
    const permitidos: string[] = [STATUS.ERROR, STATUS.NOT_FOUND, STATUS.PROCESSING]
    if (!permitidos.includes(requeue)) {
      return jsonResponse({ ok: false, error: 'requeue_invalido' }, 400)
    }

    const { error, count } = await adminSb
      .from('alwayson_clientes_estrategicos')
      .update({ geo_status: STATUS.PENDING }, { count: 'exact' })
      .eq('geo_status', requeue)
      .eq('ativo', true)
    if (error) return jsonResponse({ ok: false, error: 'requeue_falhou' }, 500)
    return jsonResponse({
      ok: true,
      mode: 'requeue',
      requeued: count ?? 0,
      fila: await contadores(adminSb),
    })
  }

  // Candidatos vêm da view, para nunca gastar chamada externa com CNPJ que já
  // resolve coordenada por fonte melhor (carteira / universo PDV / Insights).
  let q = adminSb
    .from('alwayson_clientes_estrategicos_v_lista')
    .select('id, cnpj, cidade, estado, geo_tentativas')
    .eq('ativo', true)
    .is('lat_exibicao', null)

  if (cnpjUnico.length === 14) {
    q = q.eq('cnpj', cnpjUnico).in('geo_status', [
      STATUS.PENDING,
      STATUS.PROCESSING,
      STATUS.ERROR,
      STATUS.NOT_FOUND,
    ])
  } else {
    q = q.eq('geo_status', STATUS.PENDING).order('adicionado_em', { ascending: true }).limit(limit)
    if (uf) q = q.eq('estado_exibicao', uf)
  }

  const { data: rows, error: listErr } = await q
  if (listErr) {
    console.error('lista candidatos:', listErr.message)
    return jsonResponse({ ok: false, error: 'list_failed' }, 500)
  }

  const candidatos = (rows ?? []) as Candidato[]
  if (!candidatos.length) {
    return jsonResponse({
      ok: true,
      mode: cnpjUnico ? 'single' : 'batch',
      processed: 0,
      sem_fonte: 0,
      skipped: 0,
      failed: 0,
      message: cnpjUnico ? 'CNPJ já resolvido ou fora da fila.' : 'Nenhum CNPJ pendente.',
      fila: await contadores(adminSb),
    })
  }

  const claimIn = cnpjUnico
    ? [STATUS.PENDING, STATUS.PROCESSING, STATUS.ERROR, STATUS.NOT_FOUND]
    : [STATUS.PENDING]

  let processed = 0
  let semFonte = 0
  let skipped = 0
  let failed = 0
  let porPrazo = 0

  // A BrasilAPI responde 429 com backoff de dezenas de segundos. Sem prazo, um
  // lote azarado estoura o tecto de tempo da Edge Function e morre a meio —
  // deixando linhas presas em `processing`. Com prazo, devolve o que deu e o
  // resto continua `pending` para o lote seguinte.
  const inicio = Date.now()
  const PRAZO_MS = 60_000

  for (const linha of candidatos) {
    if (Date.now() - inicio > PRAZO_MS) {
      porPrazo = candidatos.length - (processed + semFonte + skipped + failed)
      break
    }
    const r = await processarUm(adminSb, linha, { useNominatim, claimIn })
    if (r === 'ok') processed++
    else if (r === 'sem_fonte') semFonte++
    else if (r === 'skip') skipped++
    else failed++
  }

  return jsonResponse({
    ok: true,
    mode: cnpjUnico ? 'single' : 'batch',
    processed,
    sem_fonte: semFonte,
    skipped,
    failed,
    adiados: porPrazo,
    limit,
    uf: uf ?? undefined,
    fila: await contadores(adminSb),
  })
})
