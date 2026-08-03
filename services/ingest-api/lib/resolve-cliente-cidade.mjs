import { enrichCnpjGeo, normalizeCnpjDigits } from '../../../scripts/lib/insights-cnpj-geo.mjs'

export { normalizeCnpjDigits }

/** @param {string|null|undefined} cidade @param {string|null|undefined} [estado] */
export function isCidadeVazia(cidade, estado) {
  const c = String(cidade ?? '').trim()
  const e = String(estado ?? '').trim()
  const vazio = (s) => !s || s === '—' || s === '-'
  return vazio(c) || vazio(e)
}

/**
 * @typedef {{
 *   cidade: string,
 *   estado: string,
 *   source: 'insights' | 'brasilapi' | null,
 *   endereco_logradouro?: string | null,
 *   endereco_numero?: string | null,
 *   endereco_bairro?: string | null,
 *   endereco_cep?: string | null,
 *   lat?: number | null,
 *   lng?: number | null,
 * }} ClienteGeoResolved
 */

/**
 * @param {ClienteGeoResolved | null | undefined} resolved
 * @returns {Record<string, string | number> | null}
 */
export function clienteGeoPatchFromResolved(resolved) {
  if (!resolved || isCidadeVazia(resolved.cidade, resolved.estado)) return null

  /** @type {Record<string, string | number>} */
  const patch = {
    cidade: String(resolved.cidade).trim(),
    estado: String(resolved.estado).trim().toUpperCase().slice(0, 2),
    geo_enriquecido_em: new Date().toISOString(),
  }

  if (resolved.endereco_logradouro) patch.endereco_logradouro = resolved.endereco_logradouro
  if (resolved.endereco_numero) patch.endereco_numero = resolved.endereco_numero
  if (resolved.endereco_bairro) patch.endereco_bairro = resolved.endereco_bairro
  if (resolved.endereco_cep) patch.endereco_cep = resolved.endereco_cep
  if (resolved.lat != null && Number.isFinite(resolved.lat)) patch.lat = resolved.lat
  if (resolved.lng != null && Number.isFinite(resolved.lng)) patch.lng = resolved.lng

  return patch
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string[]} cnpjs14
 */
export async function loadInsightsCidadesMap(supabase, cnpjs14) {
  /** @type {Map<string, { cidade: string, estado: string }>} */
  const map = new Map()
  const uniq = [...new Set(cnpjs14.map((c) => normalizeCnpjDigits(c)).filter((c) => c.length === 14))]
  for (let i = 0; i < uniq.length; i += 100) {
    const chunk = uniq.slice(i, i + 100)
    const { data, error } = await supabase
      .from('alwayson_insights_clientes')
      .select('cnpj_14, cidade, estado')
      .in('cnpj_14', chunk)
    if (error) throw error
    for (const row of data ?? []) {
      const cnpj = String(row.cnpj_14 ?? '')
      const cidade = row.cidade != null ? String(row.cidade).trim() : ''
      const estado = row.estado != null ? String(row.estado).trim() : ''
      if (cnpj.length === 14 && !isCidadeVazia(cidade, estado)) {
        map.set(cnpj, { cidade, estado })
      }
    }
  }
  return map
}

/**
 * Insights primeiro; BrasilAPI preenche cidade/UF e endereço fiscal quando ausente.
 *
 * @param {string} cnpj
 * @param {Map<string, { cidade: string, estado: string }>} insightsMap
 * @param {{ brasilDelayMs?: number }} [opts]
 * @returns {Promise<ClienteGeoResolved>}
 */
export async function resolveClienteCidade(cnpj, insightsMap, opts = {}) {
  const key = normalizeCnpjDigits(cnpj)
  const cached = insightsMap.get(key)
  if (cached && !isCidadeVazia(cached.cidade, cached.estado)) {
    return { cidade: cached.cidade, estado: cached.estado, source: 'insights' }
  }

  const geo = await enrichCnpjGeo(key, {
    useNominatim: false,
    brasilDelayMs: opts.brasilDelayMs ?? 350,
  })
  if (geo.ok && geo.cidade && geo.estado) {
    return {
      cidade: geo.cidade,
      estado: geo.estado,
      source: 'brasilapi',
      endereco_logradouro: geo.logradouro ?? null,
      endereco_numero: geo.numero ?? null,
      endereco_bairro: geo.bairro ?? null,
      endereco_cep: geo.cep ?? null,
      lat: geo.lat ?? null,
      lng: geo.lng ?? null,
    }
  }

  return { cidade: '—', estado: '—', source: null }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string[]} cnpjs
 * @param {{ brasilDelayMs?: number, onWarning?: (msg: string) => void, onProgress?: (cur: number, total: number, cnpj: string) => void }} [opts]
 * @returns {Promise<Map<string, ClienteGeoResolved>>}
 */
export async function resolveClienteCidadesBatch(supabase, cnpjs, opts = {}) {
  const keys = [...new Set(cnpjs.map((c) => normalizeCnpjDigits(c)).filter((c) => c.length === 14))]
  const insightsMap = await loadInsightsCidadesMap(supabase, keys)
  /** @type {Map<string, ClienteGeoResolved>} */
  const out = new Map()

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    opts.onProgress?.(i + 1, keys.length, key)

    const ins = insightsMap.get(key)
    if (ins) {
      out.set(key, { ...ins, source: 'insights' })
      continue
    }

    const resolved = await resolveClienteCidade(key, insightsMap, opts)
    out.set(key, resolved)
    if (resolved.source === 'brasilapi' && opts.onWarning) {
      opts.onWarning(`CNPJ ${key}: cidade/endereço via BrasilAPI (não estava na base Insights)`)
    }
  }

  return out
}

/**
 * Persiste patches de geo na carteira do distribuidor.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {Array<{ id: string } & Record<string, unknown>>} patches
 */
export async function applyClienteGeoPatches(supabase, patches) {
  for (let i = 0; i < patches.length; i += 40) {
    const chunk = patches.slice(i, i + 40)
    await Promise.all(
      chunk.map(({ id, ...payload }) =>
        supabase.from('alwayson_clientes_distribuidor').update(payload).eq('id', id)
      )
    )
  }
}
