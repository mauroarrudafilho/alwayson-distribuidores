/**
 * BrasilAPI (CNPJ v1→v2) + Nominatim opcional — compartilhado entre
 * `import-insights-from-xlsx.mjs` e `enrich-insights-nf-geo.mjs`.
 *
 * Política Nominatim: ~1 req/s + User-Agent identificável.
 */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * @typedef {{
 *   ok: boolean,
 *   cidade: string|null,
 *   estado: string|null,
 *   lat: number|null,
 *   lng: number|null,
 *   geoTs: string|null,
 *   reason?: string,
 *   cadastro_ativo?: boolean,
 *   descricao_situacao_cadastral?: string|null,
 * }} EnrichGeoResult
 */

export const INSIGHTS_GEO_UA =
  'alwayson-distribuidores/1.0 (insights-geo; +https://github.com/mauroarrudafilho/alwayson-distribuidores)'

/** @param {string} raw */
export function normalizeCnpjDigits(raw) {
  let d = String(raw ?? '').replace(/\D/g, '')
  if (!d.length) return ''
  if (d.length > 14) d = d.slice(-14)
  return d.padStart(14, '0')
}

/**
 * Prefer v1: v2 pode responder 404 como HTML na edge (sem JSON).
 * @param {string} digits14
 */
async function brasilApiCnpj(digits14) {
  async function tryVer(ver) {
    const url = `https://brasilapi.com.br/api/cnpj/${ver}/${digits14}`
    for (let r429 = 0; ; r429++) {
      /** @type {Response | undefined} */
      let res
      for (let att = 0; att < 3; att++) {
        try {
          res = await fetch(url, {
            headers: { Accept: 'application/json', 'User-Agent': INSIGHTS_GEO_UA },
          })
          break
        } catch {
          if (att === 2) return { ok: false, reason: `fetch_erro_${ver}` }
          await sleep(450 * Math.pow(2, att))
        }
      }
      if (!res) return { ok: false, reason: `fetch_erro_${ver}` }
      const text = await res.text()
      /** @type {Record<string, unknown> | null} */
      let j = null
      const trimmed = text.trimStart()
      if (trimmed.startsWith('{')) {
        try {
          j = JSON.parse(text)
        } catch {
          j = null
        }
      }
      const errName = typeof j?.name === 'string' ? j.name : ''
      const errType = typeof j?.type === 'string' ? j.type : ''

      if (res.ok) {
        if (!j || typeof j !== 'object') return { ok: false, reason: `${ver}_resposta_sem_json` }
        return { ok: true, data: j }
      }
      if (res.status === 429 && r429 < 7) {
        await sleep(Math.min(45_000, 2500 * Math.pow(2, Math.min(r429, 5))))
        continue
      }
      if (j && (errType === 'BadRequestError' || errName === 'BadRequestError'))
        return { ok: false, reason: `${ver}_cnpj_invalido` }
      return { ok: false, reason: `http_${res.status}_${ver}` }
    }
  }

  const v1 = await tryVer('v1')
  if (v1.ok) return v1
  const v2 = await tryVer('v2')
  if (v2.ok) return v2
  return {
    ok: false,
    reason: [v1.reason, v2.reason].filter(Boolean).join('; ') || 'brasilapi_falhou',
  }
}

async function nominatimSearch(query) {
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    limit: '1',
    countrycodes: 'br',
  })
  const url = `https://nominatim.openstreetmap.org/search?${params}`
  await sleep(1100)
  /** @type {Response | undefined} */
  let res
  for (let att = 0; att < 3; att++) {
    try {
      res = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': INSIGHTS_GEO_UA },
      })
      break
    } catch {
      if (att === 2) return null
      await sleep(500 * Math.pow(2, att))
    }
  }
  if (!res || !res.ok) return null
  /** @type {Array<{ lat: string; lon: string }>} */
  const arr = await res.json()
  if (!arr?.length) return null
  return {
    lat: parseFloat(arr[0].lat),
    lng: parseFloat(arr[0].lon),
  }
}

/** @param {unknown} mun */
function municipioNome(mun) {
  if (mun == null) return ''
  if (typeof mun === 'string') return mun.trim()
  if (typeof mun === 'object' && mun !== null && 'descricao' in mun) {
    const d = mun.descricao
    return d != null ? String(d).trim() : ''
  }
  return ''
}

/** @param {Record<string, unknown>} d */
export function cidadeUfPostal(d) {
  const nested =
    typeof d.endereco === 'object' && d.endereco !== null
      ? /** @type {Record<string, unknown>} */ (d.endereco)
      : null

  const cidade =
    (d.municipio != null ? String(d.municipio).trim() : '') ||
    (nested?.municipio != null ? municipioNome(nested.municipio) : '') ||
    (nested?.municipioJurisdicao != null ? municipioNome(nested.municipioJurisdicao) : '')

  const ufRaw =
    (d.uf != null ? String(d.uf).trim() : '') ||
    (nested?.uf != null ? String(nested.uf).trim() : '')

  const tipo = String(
    d.descricao_tipo_logradouro ??
      nested?.descricaoTipoLogradouro ??
      nested?.tipoLogradouro ??
      ''
  ).trim()

  const logr = String(d.logradouro ?? nested?.logradouro ?? '').trim()
  const numero = String(d.numero ?? nested?.numero ?? '').trim()
  const bairro = String(d.bairro ?? nested?.bairro ?? '').trim()
  const cep = String(d.cep ?? nested?.cep ?? '').replace(/\D/g, '')

  return {
    cidade: cidade || null,
    uf: ufRaw.toUpperCase().slice(0, 2) || null,
    tipo,
    logr,
    numero,
    bairro,
    cep,
  }
}

/** @param {Record<string, unknown>} d */
function buildAddressQuery(d) {
  const { cidade: mun, uf, tipo, logr, numero, bairro, cep } = cidadeUfPostal(d)
  const parts = [
    [tipo, logr].filter(Boolean).join(' '),
    numero,
    bairro,
    mun ?? '',
    uf ?? '',
    cep ? `CEP ${cep}` : '',
    'Brasil',
  ].filter(Boolean)
  return parts.join(', ')
}

/**
 * A partir do JSON da BrasilAPI (v1/v2), indica se a situação cadastral é ATIVA na Receita.
 * @param {Record<string, unknown>|null|undefined} data
 */
export function brasilApiCadastroAtivo(data) {
  if (!data || typeof data !== 'object') return false
  const desc = String(
    data.descricao_situacao_cadastral ?? data.descricaoSituacaoCadastral ?? ''
  ).trim()
  if (desc && desc.toUpperCase() === 'ATIVA') return true
  const code = data.situacao_cadastral ?? data.situacaoCadastral
  if (code === 2 || code === '2') return true
  return false
}

/**
 * Um CNPJ (14 dígitos): cidade/UF via BrasilAPI; lat/lng opcional via Nominatim.
 * @param {string} digits14
 * @param {{ useNominatim?: boolean, brasilDelayMs?: number }} [opts]
 */
export async function enrichCnpjGeo(digits14, opts = {}) {
  const { useNominatim = false, brasilDelayMs = 350 } = opts

  const fail = (reason) => ({
    ok: false,
    reason,
    cidade: null,
    estado: null,
    lat: null,
    lng: null,
    geoTs: null,
    cadastro_ativo: undefined,
    descricao_situacao_cadastral: null,
  })

  if (digits14.length !== 14) return fail('cnpj_len')

  const br = await brasilApiCnpj(digits14)
  await sleep(Math.max(0, brasilDelayMs))

  if (!br.ok) return fail(String(br.reason ?? 'brasil_api'))

  const d = /** @type {Record<string, unknown>} */ (br.data)
  const postal = cidadeUfPostal(d)
  const cidade = postal.cidade
  const estado = postal.uf
  const situacaoDesc = String(d.descricao_situacao_cadastral ?? d.descricaoSituacaoCadastral ?? '')
    .trim()
  const cadastro_ativo = brasilApiCadastroAtivo(d)

  let lat = null
  let lng = null
  let geoTs = null

  if (useNominatim) {
    const q = buildAddressQuery(d)
    if (q.length > 15) {
      const geo = await nominatimSearch(q)
      if (geo && Number.isFinite(geo.lat) && Number.isFinite(geo.lng)) {
        lat = geo.lat
        lng = geo.lng
        geoTs = new Date().toISOString()
      }
    }
  }

  return {
    ok: true,
    cidade,
    estado,
    lat,
    lng,
    geoTs,
    cadastro_ativo,
    descricao_situacao_cadastral: situacaoDesc || null,
  }
}

/**
 * Mapa CNPJ14 → resultado (deduplica lista de entrada).
 * @param {string[]} cnpjList
 * @param {{
 *   useNominatim?: boolean,
 *   brasilDelayMs?: number,
 *   concurrency?: number,
 *   onProgress?: (cur: number, total: number, digits: string) => void,
 * }} [options]
 * @returns {Promise<Map<string, EnrichGeoResult>>}
 */
export async function enrichInsightsCnpjBatch(cnpjList, options = {}) {
  const {
    useNominatim = false,
    brasilDelayMs = 350,
    concurrency = 1,
    onProgress,
  } = options
  const unique = [
    ...new Set(cnpjList.map((c) => normalizeCnpjDigits(c)).filter((d) => d.length === 14)),
  ]
  /** @type {Map<string, EnrichGeoResult>} */
  const map = new Map()
  const total = unique.length
  if (total === 0) return map

  const workers = Math.max(1, Math.min(32, Math.floor(concurrency)))

  if (workers <= 1) {
    for (let i = 0; i < total; i++) {
      const digits = unique[i]
      const r = await enrichCnpjGeo(digits, { useNominatim, brasilDelayMs })
      map.set(digits, r)
      onProgress?.(i + 1, total, digits)
    }
    return map
  }

  let next = 0
  let completed = 0

  async function runWorker() {
    for (;;) {
      const i = next++
      if (i >= total) break
      const digits = unique[i]
      const r = await enrichCnpjGeo(digits, { useNominatim, brasilDelayMs })
      map.set(digits, r)
      completed++
      onProgress?.(completed, total, digits)
    }
  }

  await Promise.all(Array.from({ length: Math.min(workers, total) }, () => runWorker()))
  return map
}
