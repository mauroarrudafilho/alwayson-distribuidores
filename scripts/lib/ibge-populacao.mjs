/**
 * População municipal IBGE — helpers compartilhados (CLI sync).
 */

export const UF_CODES = {
  AC: 12,
  AL: 27,
  AM: 13,
  AP: 16,
  BA: 29,
  CE: 23,
  DF: 53,
  ES: 32,
  GO: 52,
  MA: 21,
  MG: 31,
  MS: 50,
  MT: 51,
  PA: 15,
  PB: 25,
  PE: 26,
  PI: 22,
  PR: 41,
  RJ: 33,
  RN: 24,
  RO: 11,
  RR: 14,
  RS: 43,
  SC: 42,
  SE: 28,
  SP: 35,
  TO: 17,
}

const CHUNK_SIZE = 8
const CHUNK_DELAY_MS = 180

export function normalizeMunicipioNome(n) {
  return String(n ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[-/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const IBGE_NOME_ALIASES = {
  'RN|ares': 'arez',
  'RN|boa saude': 'januario cicco',
}

export function resolveIbgeNorm(cidade, estado) {
  const uf = String(estado).toUpperCase().trim()
  const norm = normalizeMunicipioNome(cidade)
  return IBGE_NOME_ALIASES[`${uf}|${norm}`] ?? norm
}

const ufMunicipiosCache = new Map()

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

export async function fetchMunicipiosUf(uf) {
  const key = String(uf).toUpperCase()
  if (ufMunicipiosCache.has(key)) return ufMunicipiosCache.get(key)
  const code = UF_CODES[key]
  if (!code) return []
  const res = await fetch(
    `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${code}/municipios`
  )
  if (!res.ok) throw new Error(`IBGE municípios ${uf}: ${res.status}`)
  const data = await res.json()
  const rows = data.map((m) => ({
    id: m.id,
    nome: m.nome,
    nomeNorm: normalizeMunicipioNome(m.nome),
  }))
  ufMunicipiosCache.set(key, rows)
  return rows
}

export async function fetchPopulacaoBatch(municipioIds) {
  const out = new Map()
  if (!municipioIds.length) return out

  for (let i = 0; i < municipioIds.length; i += CHUNK_SIZE) {
    const chunk = municipioIds.slice(i, i + CHUNK_SIZE)
    const loc = chunk.map((id) => `N6[${id}]`).join('|')
    const url = `https://servicodados.ibge.gov.br/api/v3/agregados/4714/periodos/2022/variaveis/93?localidades=${encodeURIComponent(loc)}`

    let json = null
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(url)
        if (!res.ok) break
        json = await res.json()
        break
      } catch {
        await sleep(400 * (attempt + 1))
      }
    }

    if (json) {
      for (const ag of json ?? []) {
        for (const resItem of ag.resultados ?? []) {
          for (const s of resItem.series ?? []) {
            const id = Number(s.localidade?.id)
            const popRaw = s.serie?.['2022']
            const pop = popRaw != null ? Number(String(popRaw).replace(/\D/g, '')) : NaN
            if (Number.isFinite(id) && Number.isFinite(pop) && pop > 0) out.set(id, pop)
          }
        }
      }
    }

    if (i + CHUNK_SIZE < municipioIds.length) await sleep(CHUNK_DELAY_MS)
  }
  return out
}

export async function resolvePopulacaoDetalhada(cidades) {
  const byUf = new Map()
  for (const c of cidades) {
    const cidade = String(c.cidade ?? '').trim()
    const estado = String(c.estado ?? '').trim().toUpperCase()
    if (!cidade || !estado || cidade.startsWith('—')) continue
    const arr = byUf.get(estado) ?? []
    arr.push({ cidade, estado })
    byUf.set(estado, arr)
  }

  const rows = []
  for (const [uf, refs] of byUf) {
    const municipios = await fetchMunicipiosUf(uf)
    const idByNorm = new Map(municipios.map((m) => [m.nomeNorm, m]))
    const matched = []

    for (const ref of refs) {
      const hit = idByNorm.get(resolveIbgeNorm(ref.cidade, ref.estado))
      if (hit) matched.push({ ref, hit })
    }

    if (!matched.length) continue

    const popById = await fetchPopulacaoBatch([...new Set(matched.map((m) => m.hit.id))])
    for (const { ref, hit } of matched) {
      const pop = popById.get(hit.id)
      if (!pop) continue
      rows.push({
        cidade_norm: normalizeMunicipioNome(ref.cidade),
        estado: uf,
        cidade_exibicao: ref.cidade,
        codigo_ibge: hit.id,
        populacao: pop,
        ano_referencia: 2022,
        sincronizado_em: new Date().toISOString(),
      })
    }
  }

  return rows
}
