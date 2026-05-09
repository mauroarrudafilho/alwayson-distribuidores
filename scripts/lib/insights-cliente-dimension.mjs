/**
 * Estado de enriquecimento BrasilAPI por CNPJ na dimensão alwayson_insights_clientes.
 * Usado pelo import Insights e pelo worker de pendentes.
 */

/** @readonly */
export const CLIENTE_BRASIL_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  READY: 'ready',
  NOT_FOUND: 'not_found',
  ERROR: 'error',
}

/**
 * Falha BrasilAPI irreversível (CNPJ inválido / 404 típico) vs erro retentável/redes.
 * @param {string|undefined|null} reason
 */
export function brasilReasonToStatus(reason) {
  const r = String(reason ?? '')
  if (/cnpj_invalido|invalido|404|_404/i.test(r)) return CLIENTE_BRASIL_STATUS.NOT_FOUND
  return CLIENTE_BRASIL_STATUS.ERROR
}

/**
 * Dimensão com snapshot BrasilAPI válido — evita novo round-trip no import quando política permite.
 *
 * Legacy: antes desta migração, `cadastro_ativo` pode ser null mas havia tentativa OK (motivo null).
 *
 * @param {Record<string, unknown> | undefined|null} prev
 * @param {{ somenteCnpjAtivos: boolean }} opts
 */
export function canReuseBrasilApiFromClienteRow(prev, opts) {
  if (!prev) return false
  const status = String(prev.brasil_enriquecimento_status ?? CLIENTE_BRASIL_STATUS.PENDING)
  if (status !== CLIENTE_BRASIL_STATUS.READY) return false

  if (!opts.somenteCnpjAtivos) return true

  if (prev.cadastro_ativo === true) return true
  if (prev.cadastro_ativo === false) return false

  const motivoEmpty =
    prev.brasil_api_ultimo_motivo == null || String(prev.brasil_api_ultimo_motivo).trim() === ''
  const tentou = prev.brasil_api_ultima_tentativa_em != null
  return tentou && motivoEmpty
}

/**
 * @param {Record<string, unknown>} prev
 */
export function geoEnrichResultFromClienteRow(prev) {
  const latRaw = prev.lat
  const lngRaw = prev.lng
  const lat =
    latRaw != null && latRaw !== ''
      ? (() => {
          const n = Number(latRaw)
          return Number.isFinite(n) ? n : null
        })()
      : null
  const lng =
    lngRaw != null && lngRaw !== ''
      ? (() => {
          const n = Number(lngRaw)
          return Number.isFinite(n) ? n : null
        })()
      : null
  /** @type {boolean | undefined} */
  let cadastro
  if (prev.cadastro_ativo === true) cadastro = true
  else if (prev.cadastro_ativo === false) cadastro = false

  const legacyOk =
    prev.cadastro_ativo == null &&
    prev.brasil_api_ultima_tentativa_em != null &&
    (prev.brasil_api_ultimo_motivo == null || String(prev.brasil_api_ultimo_motivo).trim() === '')
  if (legacyOk && cadastro === undefined) cadastro = true

  return {
    ok: true,
    cidade: prev.cidade != null ? String(prev.cidade) : null,
    estado: prev.estado != null ? String(prev.estado) : null,
    lat,
    lng,
    geoTs: prev.geo_enriquecido_em != null ? String(prev.geo_enriquecido_em) : null,
    cadastro_ativo: cadastro,
    descricao_situacao_cadastral:
      prev.descricao_situacao_cadastral != null ? String(prev.descricao_situacao_cadastral) : null,
  }
}

/**
 * Payload Supabase por CNPJ (upsert linha mestre cliente).
 *
 * @param {string} cnpj14
 * @param {Record<string, string | null>} header
 * @param {Record<string, unknown>|undefined|null} prev
 * @param {{ ok: boolean, cidade?: string|null, estado?: string|null, lat?: number|null, lng?: number|null, geoTs?: string|null, reason?: string, cadastro_ativo?: boolean, descricao_situacao_cadastral?: string|null }|undefined|null} geoR
 * @param {{ geoImport: boolean, brasilAttemptedForCnpj: boolean }} opts
 */
export function buildInsightsClienteUpsertPayload(cnpj14, header, prev, geoR, opts) {
  const nowIso = new Date().toISOString()
  const razao =
    pickText(header?.razao, prev?.razao_social != null ? String(prev.razao_social) : null) ?? null
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
  let tentativa = prev?.brasil_api_ultima_tentativa_em ?? null

  /** @type {boolean | null} */
  let cadastro_ativo =
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

/** @param {unknown} a @param {unknown} b */
function pickText(a, b) {
  const norm = (v) => {
    if (v == null) return ''
    const s = String(v).trim()
    return s || ''
  }
  const t = norm(a) || norm(b)
  return t || null
}
