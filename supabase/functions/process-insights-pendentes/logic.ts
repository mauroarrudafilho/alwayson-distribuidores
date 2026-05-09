/**
 * Replica o fluxo de scripts/lib/insights-cnpj-geo.mjs e insights-cliente-dimension.mjs
 * para uso na Edge Function (Deno).
 */
export const INSIGHTS_GEO_UA =
  'alwayson-distribuidores/1.0 (insights-geo-worker; +https://github.com/mauroarrudafilho/alwayson-distribuidores)'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export const CLIENTE_BRASIL_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  READY: 'ready',
  NOT_FOUND: 'not_found',
  ERROR: 'error',
} as const

export function normalizeCnpjDigits(raw: string): string {
  let d = String(raw ?? '').replace(/\D/g, '')
  if (!d.length) return ''
  if (d.length > 14) d = d.slice(-14)
  return d.padStart(14, '0')
}

export function brasilReasonToStatus(reason?: string | null): string {
  const r = String(reason ?? '')
  if (/cnpj_invalido|invalido|404|_404/i.test(r)) return CLIENTE_BRASIL_STATUS.NOT_FOUND
  return CLIENTE_BRASIL_STATUS.ERROR
}

function municipioNome(mun: unknown): string {
  if (mun == null) return ''
  if (typeof mun === 'string') return mun.trim()
  if (typeof mun === 'object' && mun !== null && 'descricao' in mun) {
    const d = (mun as { descricao?: unknown }).descricao
    return d != null ? String(d).trim() : ''
  }
  return ''
}

export function cidadeUfPostal(d: Record<string, unknown>): {
  cidade: string | null
  uf: string | null
  tipo: string
  logr: string
  numero: string
  bairro: string
  cep: string
} {
  const nested =
    typeof d.endereco === 'object' && d.endereco !== null
      ? (d.endereco as Record<string, unknown>)
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

function buildAddressQuery(d: Record<string, unknown>): string {
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

export function brasilApiCadastroAtivo(data: Record<string, unknown> | null | undefined): boolean {
  if (!data || typeof data !== 'object') return false
  const desc = String(
    data.descricao_situacao_cadastral ?? data.descricaoSituacaoCadastral ?? ''
  ).trim()
  if (desc && desc.toUpperCase() === 'ATIVA') return true
  const code = data.situacao_cadastral ?? data.situacaoCadastral
  if (code === 2 || code === '2') return true
  return false
}

async function brasilApiCnpj(digits14: string): Promise<
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; reason: string }
> {
  async function tryVer(
    ver: string
  ): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; reason: string }> {
    const url = `https://brasilapi.com.br/api/cnpj/${ver}/${digits14}`
    for (let r429 = 0; ; r429++) {
      let res: Response | undefined
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
      let j: Record<string, unknown> | null = null
      const trimmed = text.trimStart()
      if (trimmed.startsWith('{')) {
        try {
          j = JSON.parse(text) as Record<string, unknown>
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
    reason: [!v1.ok && 'reason' in v1 ? v1.reason : '', !v2.ok && 'reason' in v2 ? v2.reason : '']
      .filter(Boolean)
      .join('; ') || 'brasilapi_falhou',
  }
}

async function nominatimSearch(query: string): Promise<{ lat: number; lng: number } | null> {
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    limit: '1',
    countrycodes: 'br',
  })
  const url = `https://nominatim.openstreetmap.org/search?${params}`
  await sleep(1100)
  let res: Response | undefined
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
  const arr = (await res.json()) as Array<{ lat: string; lon: string }>
  if (!arr?.length) return null
  return {
    lat: parseFloat(arr[0].lat),
    lng: parseFloat(arr[0].lon),
  }
}

export type GeoEnrichResult = {
  ok: boolean
  cidade: string | null
  estado: string | null
  lat: number | null
  lng: number | null
  geoTs: string | null
  reason?: string
  cadastro_ativo?: boolean
  descricao_situacao_cadastral?: string | null
}

export async function enrichCnpjGeo(
  digits14: string,
  opts: { useNominatim?: boolean; brasilDelayMs?: number } = {}
): Promise<GeoEnrichResult> {
  const { useNominatim = false, brasilDelayMs = 350 } = opts

  const fail = (reason: string): GeoEnrichResult => ({
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

  const d = br.data
  const postal = cidadeUfPostal(d)
  const cidade = postal.cidade
  const estado = postal.uf
  const situacaoDesc = String(d.descricao_situacao_cadastral ?? d.descricaoSituacaoCadastral ?? '')
    .trim()
  const cadastro_ativo = brasilApiCadastroAtivo(d)

  let lat: number | null = null
  let lng: number | null = null
  let geoTs: string | null = null

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

function pickText(a: unknown, b: unknown): string | null {
  const norm = (v: unknown) => {
    if (v == null) return ''
    const s = String(v).trim()
    return s || ''
  }
  const t = norm(a) || norm(b)
  return t || null
}

export function buildInsightsClienteUpsertPayload(
  cnpj14: string,
  header: { razao?: string | null; nome_cliente?: string | null },
  prev: Record<string, unknown> | null | undefined,
  geoR: GeoEnrichResult | null | undefined,
  opts: { geoImport: boolean; brasilAttemptedForCnpj: boolean }
): Record<string, unknown> {
  const nowIso = new Date().toISOString()
  const razao =
    pickText(header?.razao, prev?.razao_social != null ? String(prev.razao_social) : null) ??
    null
  const nome =
    pickText(header?.nome_cliente, prev?.nome_cliente != null ? String(prev.nome_cliente) : null) ??
    null

  let cidade = prev?.cidade != null ? String(prev.cidade) : null
  let estado = prev?.estado != null ? String(prev.estado) : null
  let latRaw = prev?.lat
  let lngRaw = prev?.lng
  let lat = latRaw != null && latRaw !== '' ? Number(latRaw) : null
  let lng = lngRaw != null && lngRaw !== '' ? Number(lngRaw) : null
  let geoTs = prev?.geo_enriquecido_em != null ? String(prev.geo_enriquecido_em) : null
  let motivo = prev?.brasil_api_ultimo_motivo != null ? String(prev.brasil_api_ultimo_motivo) : null
  let tentativa: string | null =
    prev?.brasil_api_ultima_tentativa_em != null
      ? String(prev.brasil_api_ultima_tentativa_em)
      : null

  let cadastro_ativo: boolean | null =
    prev?.cadastro_ativo === true ? true : prev?.cadastro_ativo === false ? false : null
  let descricao_situacao_cadastral =
    prev?.descricao_situacao_cadastral != null ? String(prev.descricao_situacao_cadastral) : null

  let brasil_status = String(prev?.brasil_enriquecimento_status ?? CLIENTE_BRASIL_STATUS.PENDING)

  if (opts.brasilAttemptedForCnpj && geoR) {
    tentativa = nowIso
    if (geoR.ok) {
      if (opts.geoImport) {
        if (geoR.cidade != null) cidade = geoR.cidade
        if (geoR.estado != null) estado = geoR.estado
        if (geoR.lat != null) lat = Number(geoR.lat)
        if (geoR.lng != null) lng = Number(geoR.lng)
        if (geoR.geoTs != null) geoTs = geoR.geoTs
      }
      motivo = null
      if (geoR.cadastro_ativo === false) cadastro_ativo = false
      else if (geoR.cadastro_ativo === true) cadastro_ativo = true
      if (geoR.descricao_situacao_cadastral != null)
        descricao_situacao_cadastral = geoR.descricao_situacao_cadastral
      brasil_status = CLIENTE_BRASIL_STATUS.READY
    } else if (geoR.reason != null) {
      motivo = String(geoR.reason)
      brasil_status = brasilReasonToStatus(geoR.reason)
      cadastro_ativo = null
      descricao_situacao_cadastral = null
    }
  }

  return {
    cnpj_14: cnpj14,
    razao_social: razao,
    nome_cliente: nome,
    cidade,
    estado,
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    geo_enriquecido_em: geoTs,
    brasil_api_ultima_tentativa_em: tentativa,
    brasil_api_ultimo_motivo: motivo,
    cadastro_ativo,
    descricao_situacao_cadastral,
    brasil_enriquecimento_status: brasil_status,
  }
}
