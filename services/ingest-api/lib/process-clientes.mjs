import {
  cellStr,
  missingColumns,
  parseDocumento,
  pick,
  readSheetRows,
} from './sheet.mjs'
import {
  isCidadeVazia,
  normalizeCnpjDigits,
  resolveClienteCidadesBatch,
  clienteGeoPatchFromResolved,
} from './resolve-cliente-cidade.mjs'

const REQUIRED = ['cnpj', 'razao_social']
const ALIASES = {
  cnpj: ['cnpj_cliente'],
  razao_social: ['razao'],
  nome_fantasia: ['nome_cliente', 'nome'],
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ buffer: Buffer, distribuidorId: string }} args
 */
export async function processClientes(supabase, { buffer, distribuidorId }) {
  const { headers, rows } = readSheetRows(buffer)
  const missing = missingColumns(headers, REQUIRED, ALIASES)
  if (missing.length) {
    const err = new Error(`Colunas obrigatórias ausentes: ${missing.join(', ')}`)
    err.code = 'formato_invalido'
    err.status = 422
    throw err
  }

  /** @type {Map<string, string>} */
  const vendCache = new Map()
  async function ensureVendedor(codigo, nome) {
    if (!codigo && !nome) return null
    const key = codigo || nome
    if (vendCache.has(key)) return vendCache.get(key)

    if (codigo) {
      const { data: existing } = await supabase
        .from('alwayson_vendedores_distribuidor')
        .select('id')
        .eq('distribuidor_id', distribuidorId)
        .eq('tipo', 'vendedor')
        .eq('codigo_externo', codigo)
        .maybeSingle()
      if (existing?.id) {
        vendCache.set(key, existing.id)
        return existing.id
      }
    }

    const { data: created, error } = await supabase
      .from('alwayson_vendedores_distribuidor')
      .insert({
        distribuidor_id: distribuidorId,
        nome: nome || `Vendedor ${codigo}`,
        tipo: 'vendedor',
        codigo_externo: codigo || null,
        ativo: true,
      })
      .select('id')
      .single()
    if (error) throw error
    vendCache.set(key, created.id)
    return created.id
  }

  /** @type {Array<{ line: number, cnpj: string, razao: string, nome: string, cidade: string, estado: string, codVend: string, nomeVend: string }>} */
  const parsed = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const cnpj = parseDocumento(pick(row, 'cnpj', ALIASES.cnpj))
    const razao = cellStr(pick(row, 'razao_social', ALIASES.razao_social))
    const nome = cellStr(pick(row, 'nome_fantasia', ALIASES.nome_fantasia)) || razao
    const cidadeRaw = cellStr(pick(row, 'cidade'))
    const estadoRaw = cellStr(pick(row, 'estado')).toUpperCase().slice(0, 2)
    const cidade = cidadeRaw || '—'
    const estado = estadoRaw || '—'
    const codVend = cellStr(pick(row, 'codigo_vendedor'))
    const nomeVend = cellStr(pick(row, 'nome_vendedor'))

    if (!cnpj || !razao) continue

    parsed.push({
      line: i + 2,
      cnpj,
      razao,
      nome,
      cidade,
      estado,
      codVend,
      nomeVend,
    })
  }

  if (!parsed.length) {
    const err = new Error('Nenhuma linha válida de clientes')
    err.code = 'formato_invalido'
    err.status = 422
    throw err
  }

  const cnpjsSemGeo = parsed
    .filter((p) => isCidadeVazia(p.cidade, p.estado))
    .map((p) => p.cnpj)

  const warnings = []
  const geoMap = await resolveClienteCidadesBatch(supabase, cnpjsSemGeo, {
    onWarning: (msg) => warnings.push(msg),
  })

  let count = 0

  for (const p of parsed) {
    const vendedorId = await ensureVendedor(p.codVend, p.nomeVend)

    const { data: existing } = await supabase
      .from('alwayson_clientes_distribuidor')
      .select('id, cidade, estado')
      .eq('distribuidor_id', distribuidorId)
      .eq('cnpj', p.cnpj)
      .maybeSingle()

    let cidade = p.cidade
    let estado = p.estado
    /** @type {Record<string, unknown>} */
    let geoExtra = {}

    if (isCidadeVazia(cidade, estado)) {
      const geoPatch = clienteGeoPatchFromResolved(geoMap.get(normalizeCnpjDigits(p.cnpj)))
      if (geoPatch) {
        cidade = String(geoPatch.cidade)
        estado = String(geoPatch.estado)
        geoExtra = geoPatch
      }
    } else if (existing && isCidadeVazia(existing.cidade, existing.estado)) {
      geoExtra = { cidade, estado, geo_enriquecido_em: new Date().toISOString() }
    }

    const payload = {
      distribuidor_id: distribuidorId,
      cnpj: p.cnpj,
      razao_social: p.razao,
      nome_fantasia: p.nome,
      cidade,
      estado,
      vendedor_id: vendedorId,
      status: 'ativo',
      atualizado_em: new Date().toISOString(),
      ...geoExtra,
    }

    if (existing?.id) {
      if (!isCidadeVazia(existing.cidade, existing.estado)) {
        const {
          cidade: _c,
          estado: _e,
          endereco_logradouro: _l,
          endereco_numero: _n,
          endereco_bairro: _b,
          endereco_cep: _cep,
          lat: _lat,
          lng: _lng,
          geo_enriquecido_em: _geo,
          ...rest
        } = payload
        const { error } = await supabase
          .from('alwayson_clientes_distribuidor')
          .update(rest)
          .eq('id', existing.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('alwayson_clientes_distribuidor')
          .update(payload)
          .eq('id', existing.id)
        if (error) throw error
      }
    } else {
      const { error } = await supabase.from('alwayson_clientes_distribuidor').insert(payload)
      if (error) throw error
    }
    count += 1
  }

  return {
    registros_processados: count,
    detalhes: { avisos: [...new Set(warnings)].slice(0, 50) },
  }
}
