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
 * Insights primeiro; BrasilAPI só se não houver cidade na base territorial.
 *
 * @param {string} cnpj
 * @param {Map<string, { cidade: string, estado: string }>} insightsMap
 * @param {{ brasilDelayMs?: number }} [opts]
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
    return { cidade: geo.cidade, estado: geo.estado, source: 'brasilapi' }
  }

  return { cidade: '—', estado: '—', source: null }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string[]} cnpjs
 * @param {{ brasilDelayMs?: number, onWarning?: (msg: string) => void }} [opts]
 */
export async function resolveClienteCidadesBatch(supabase, cnpjs, opts = {}) {
  const keys = [...new Set(cnpjs.map((c) => normalizeCnpjDigits(c)).filter((c) => c.length === 14))]
  const insightsMap = await loadInsightsCidadesMap(supabase, keys)
  /** @type {Map<string, { cidade: string, estado: string, source: string|null }>} */
  const out = new Map()

  for (const key of keys) {
    const ins = insightsMap.get(key)
    if (ins) {
      out.set(key, { ...ins, source: 'insights' })
      continue
    }
    const resolved = await resolveClienteCidade(key, insightsMap, opts)
    out.set(key, resolved)
    if (resolved.source === 'brasilapi' && opts.onWarning) {
      opts.onWarning(`CNPJ ${key}: cidade via BrasilAPI (não estava na base Insights)`)
    }
  }

  return out
}
