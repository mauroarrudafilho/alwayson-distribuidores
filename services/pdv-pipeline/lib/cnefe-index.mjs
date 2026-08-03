import * as fs from 'node:fs'
import * as readline from 'node:readline'

import {
  chaveExact,
  chaveLogCep,
  montaLogradouroCnefe,
  normalizaCep,
  normalizaNumero,
} from './endereco-normalize.mjs'

function parseLatLng(lat, lng) {
  const la = Number(String(lat).replace(',', '.'))
  const lo = Number(String(lng).replace(',', '.'))
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return null
  if (la === 0 && lo === 0) return null
  return { lat: la, lng: lo }
}

function acumula(map, key, lat, lng, setor) {
  if (!key) return
  let row = map.get(key)
  if (!row) {
    row = { sumLat: 0, sumLng: 0, count: 0, setor: setor ?? null }
    map.set(key, row)
  }
  row.sumLat += lat
  row.sumLng += lng
  row.count += 1
  if (setor) row.setor = setor
}

function centro(row) {
  return {
    latitude: row.sumLat / row.count,
    longitude: row.sumLng / row.count,
    cod_setor: row.setor,
  }
}

/**
 * Indexa CNEFE municipal (CSV ; IBGE) para cascata de geocode.
 */
export async function carregarIndiceCnefe(csvPath) {
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CNEFE não encontrado: ${csvPath}`)
  }

  const exact = new Map()
  const logCep = new Map()
  const cep = new Map()
  const setor = new Map()

  const rl = readline.createInterface({
    input: fs.createReadStream(csvPath, { encoding: 'latin1' }),
    crlfDelay: Infinity,
  })

  let header = null
  let linhas = 0
  let comCoord = 0

  for await (const line of rl) {
    if (!line.trim()) continue
    if (!header) {
      header = line.split(';')
      continue
    }
    linhas++
    const cols = line.split(';')
    const get = (name) => cols[header.indexOf(name)] ?? ''

    const coord = parseLatLng(get('LATITUDE'), get('LONGITUDE'))
    if (!coord) continue
    comCoord++

    const log = montaLogradouroCnefe(
      get('NOM_TIPO_SEGLOGR'),
      get('NOM_TITULO_SEGLOGR'),
      get('NOM_SEGLOGR')
    )
    const numRaw = get('NUM_ENDERECO')
    const mod = get('DSC_MODIFICADOR')
    const numero =
      mod?.toUpperCase() === 'SN' || numRaw === '0' ? null : normalizaNumero(numRaw)
    const cepNorm = normalizaCep(get('CEP'))
    const codSetor = get('COD_SETOR') || null

    const kExact = chaveExact(log, numero, cepNorm)
    if (kExact && !exact.has(kExact)) {
      exact.set(kExact, {
        latitude: coord.lat,
        longitude: coord.lng,
        cod_setor: codSetor,
      })
    }

    acumula(logCep, chaveLogCep(log, cepNorm), coord.lat, coord.lng, codSetor)
    acumula(cep, cepNorm, coord.lat, coord.lng, codSetor)
    acumula(setor, codSetor, coord.lat, coord.lng, codSetor)
  }

  return {
    exact,
    logCep,
    cep,
    setor,
    stats: { linhas, com_coord: comCoord },
  }
}

export function casarEndereco(indice, row) {
  const { exact, logCep, cep, setor } = indice

  const k1 = chaveExact(row.logradouro, row.numero, row.cep)
  if (k1 && exact.has(k1)) {
    const hit = exact.get(k1)
    return {
      ...hit,
      nivel_geocodificacao: 'numero_exato',
    }
  }

  const k2 = chaveLogCep(row.logradouro, row.cep)
  if (k2 && logCep.has(k2)) {
    const hit = centro(logCep.get(k2))
    return { ...hit, nivel_geocodificacao: 'logradouro' }
  }

  const c = normalizaCep(row.cep)
  if (c && cep.has(c)) {
    const hit = centro(cep.get(c))
    return { ...hit, nivel_geocodificacao: 'cep' }
  }

  return null
}

export function resolverCsvCnefe(dataDir, codigoIbge, municipioSlug) {
  const base = String(codigoIbge)
  const slug = municipioSlug.toUpperCase().replace(/\s+/g, '_')
  const inside = `${base}_${slug}.csv`
  const direct = `${base}.csv`
  for (const name of [inside, direct]) {
    const p = `${dataDir.replace(/\/$/, '')}/${name}`
    if (fs.existsSync(p)) return p
  }
  const entries = fs.readdirSync(dataDir).filter((f) => f.startsWith(base) && f.endsWith('.csv'))
  if (entries.length === 1) return `${dataDir}/${entries[0]}`
  throw new Error(
    `CSV CNEFE não encontrado em ${dataDir} para IBGE ${codigoIbge}. Rode download-cnefe-municipio.`
  )
}
