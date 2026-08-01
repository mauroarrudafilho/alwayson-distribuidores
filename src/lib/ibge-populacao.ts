/**
 * População municipal via API pública IBGE (Censo 2022, agregado 4714).
 */

export const UF_CODES: Record<string, number> = {
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

/** Normaliza nome de município para matching (sem acentos, minúsculas). */
export function normalizeMunicipioNome(n: string): string {
  return n
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[-/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Grafias legadas / renomeações municipais → nome normalizado no IBGE. */
const IBGE_NOME_ALIASES: Record<string, string> = {
  'RN|ares': 'arez',
  'RN|boa saude': 'januario cicco',
}

/** Nome normalizado usado para buscar município no cadastro IBGE. */
export function resolveIbgeNorm(cidade: string, estado: string): string {
  const uf = estado.toUpperCase().trim()
  const norm = normalizeMunicipioNome(cidade)
  return IBGE_NOME_ALIASES[`${uf}|${norm}`] ?? norm
}

type MunicipioIbge = { id: number; nome: string; nomeNorm: string }

const ufMunicipiosCache = new Map<string, MunicipioIbge[]>()

async function fetchMunicipiosUf(uf: string): Promise<MunicipioIbge[]> {
  const key = uf.toUpperCase()
  const cached = ufMunicipiosCache.get(key)
  if (cached) return cached

  const code = UF_CODES[key]
  if (!code) return []

  const res = await fetch(
    `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${code}/municipios`
  )
  if (!res.ok) throw new Error(`IBGE municípios ${uf}: ${res.status}`)
  const data = (await res.json()) as { id: number; nome: string }[]
  const rows = data.map((m) => ({
    id: m.id,
    nome: m.nome,
    nomeNorm: normalizeMunicipioNome(m.nome),
  }))
  ufMunicipiosCache.set(key, rows)
  return rows
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function fetchPopulacaoBatch(municipioIds: number[]): Promise<Map<number, number>> {
  const out = new Map<number, number>()
  if (municipioIds.length === 0) return out

  for (let i = 0; i < municipioIds.length; i += CHUNK_SIZE) {
    const chunk = municipioIds.slice(i, i + CHUNK_SIZE)
    const loc = chunk.map((id) => `N6[${id}]`).join('|')
    const url = `https://servicodados.ibge.gov.br/api/v3/agregados/4714/periodos/2022/variaveis/93?localidades=${encodeURIComponent(loc)}`

    type IbgeAgregado = {
      resultados?: {
        series?: { localidade?: { id?: string }; serie?: Record<string, string> }[]
      }[]
    }
    let json: IbgeAgregado[] | null = null

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(url)
        if (!res.ok) break
        json = (await res.json()) as IbgeAgregado[]
        break
      } catch {
        await sleep(400 * (attempt + 1))
      }
    }

    if (json) {
      for (const ag of json) {
        for (const resItem of ag.resultados ?? []) {
          for (const s of resItem.series ?? []) {
            const id = Number(s.localidade?.id)
            const popRaw = s.serie?.['2022']
            const pop = popRaw != null ? Number(String(popRaw).replace(/\D/g, '')) : NaN
            if (Number.isFinite(id) && Number.isFinite(pop) && pop > 0) {
              out.set(id, pop)
            }
          }
        }
      }
    }

    if (i + CHUNK_SIZE < municipioIds.length) {
      await sleep(CHUNK_DELAY_MS)
    }
  }
  return out
}

export type CidadeUfRef = { cidade: string; estado: string }

export type CidadePopulacaoResolvida = {
  cidade: string
  estado: string
  cidade_norm: string
  codigo_ibge: number
  populacao: number
}

export function cidadeUfKey(cidade: string, estado: string): string {
  return `${normalizeMunicipioNome(cidade)}\t${estado.toUpperCase().trim()}`
}

/** Resolve população apenas para as cidades pedidas (não baixa UF inteira). */
export async function resolvePopulacaoCidades(
  cidades: CidadeUfRef[]
): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  const byUf = new Map<string, CidadeUfRef[]>()

  for (const c of cidades) {
    const cidade = c.cidade?.trim()
    const estado = c.estado?.trim().toUpperCase()
    if (!cidade || !estado || cidade.startsWith('—')) continue
    const arr = byUf.get(estado) ?? []
    arr.push({ cidade, estado })
    byUf.set(estado, arr)
  }

  for (const [uf, refs] of byUf) {
    const municipios = await fetchMunicipiosUf(uf)
    const idByNorm = new Map(municipios.map((m) => [m.nomeNorm, m.id]))
    const matched: { ref: CidadeUfRef; id: number }[] = []

    for (const ref of refs) {
      const id = idByNorm.get(resolveIbgeNorm(ref.cidade, ref.estado))
      if (id != null) matched.push({ ref, id })
    }

    if (matched.length === 0) continue

    const popById = await fetchPopulacaoBatch([...new Set(matched.map((m) => m.id))])
    for (const { ref, id } of matched) {
      const pop = popById.get(id)
      if (pop != null && pop > 0) {
        out.set(cidadeUfKey(ref.cidade, ref.estado), pop)
      }
    }
  }

  return out
}

/** Versão detalhada para upsert no Supabase (sync script). */
export async function resolvePopulacaoDetalhada(
  cidades: CidadeUfRef[]
): Promise<CidadePopulacaoResolvida[]> {
  const popMap = await resolvePopulacaoCidades(cidades)
  const out: CidadePopulacaoResolvida[] = []

  for (const c of cidades) {
    const cidade = c.cidade?.trim()
    const estado = c.estado?.trim().toUpperCase()
    if (!cidade || !estado || cidade.startsWith('—')) continue
    const key = cidadeUfKey(cidade, estado)
    const pop = popMap.get(key)
    if (!pop) continue

    const municipios = await fetchMunicipiosUf(estado)
    const hit = municipios.find((m) => m.nomeNorm === resolveIbgeNorm(cidade, estado))
    if (!hit) continue

    out.push({
      cidade,
      estado,
      cidade_norm: normalizeMunicipioNome(cidade),
      codigo_ibge: hit.id,
      populacao: pop,
    })
  }

  return out
}

/** @deprecated Prefer resolvePopulacaoCidades — mantido para compatibilidade interna. */
export async function fetchPopulacaoMapForUf(uf: string): Promise<Map<string, number>> {
  const municipios = await fetchMunicipiosUf(uf)
  const popById = await fetchPopulacaoBatch(municipios.map((m) => m.id))
  const map = new Map<string, number>()
  for (const m of municipios) {
    const pop = popById.get(m.id)
    if (pop != null && pop > 0) map.set(m.nomeNorm, pop)
  }
  return map
}
