import * as fs from 'node:fs'
import * as path from 'node:path'
import { streamReceitaCsv } from './csv-receita.mjs'

function normalizeNome(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .trim()
}

function normalizeCodigoReceita(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '')
  if (!digits) return null
  return String(Number(digits))
}

/** Mapa código Receita (col 20) → nome do município. */
export async function carregarMunicipiosReceita(dataDir) {
  const map = new Map()
  const files = fs
    .readdirSync(dataDir)
    .filter((f) => /\.munic/i.test(f) && !f.endsWith('.zip'))
    .sort()
  if (!files.length) {
    throw new Error(
      `Tabela Municipios da Receita não encontrada em ${dataDir}. Baixe Municipios.zip do pacote aberto.`
    )
  }
  for (const file of files) {
    await streamReceitaCsv(path.join(dataDir, file), (cols) => {
      const codigo = normalizeCodigoReceita(cols[0])
      if (!codigo) return
      map.set(codigo, cols[1]?.trim() || '')
    })
  }
  return map
}

/**
 * Traduz códigos IBGE alvo → chaves "UF:codigoReceita" para filtrar Estabelecimentos.
 */
export function filtroReceitaPorIbge(codigosIbge, uf, municipiosReceita, ibgeMap) {
  const allowed = new Set()
  for (const ibge of codigosIbge) {
    const meta = ibgeMap.get(Number(ibge))
    if (!meta || meta.uf !== uf) continue
    const alvo = normalizeNome(meta.municipio)
    for (const [cod, nome] of municipiosReceita) {
      if (normalizeNome(nome) === alvo) allowed.add(`${uf}:${cod}`)
    }
  }
  return allowed
}

export function chaveReceitaMunicipio(cols, uf) {
  const cod = normalizeCodigoReceita(cols[20])
  if (!cod) return null
  return `${uf}:${cod}`
}

export function resolveCodigoIbge(cols, uf, municipiosReceita, ibgeMap) {
  const cod = normalizeCodigoReceita(cols[20])
  if (!cod) return null
  const nomeRf = municipiosReceita.get(cod)
  if (!nomeRf) return null
  const alvo = normalizeNome(nomeRf)
  for (const [ibge, meta] of ibgeMap) {
    if (meta.uf === uf && normalizeNome(meta.municipio) === alvo) return ibge
  }
  return null
}
