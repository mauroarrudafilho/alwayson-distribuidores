import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import {
  resolvePopulacaoCidades,
  type CidadeUfRef,
  cidadeUfKey,
} from '@/lib/ibge-populacao'

const STALE_MS = 7 * 24 * 60 * 60 * 1000
const ANO_REF = 2022

async function fetchPopulacaoFromDb(
  cidades: CidadeUfRef[]
): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  if (cidades.length === 0) return out

  const estados = [...new Set(cidades.map((c) => c.estado.toUpperCase()).filter(Boolean))]
  const { data, error } = await supabase
    .from('alwayson_ibge_municipio_populacao')
    .select('cidade_norm, estado, populacao')
    .eq('ano_referencia', ANO_REF)
    .in('estado', estados)

  if (error) {
    const msg = String(error.message ?? '')
    if (msg.includes('does not exist') || msg.includes('schema cache')) {
      return out
    }
    throw error
  }

  for (const row of data ?? []) {
    const r = row as { cidade_norm: string; estado: string; populacao: number }
    out.set(`${r.cidade_norm}\t${String(r.estado).toUpperCase()}`, Number(r.populacao))
  }

  return out
}

export function useInsightsPopulacao(cidades: CidadeUfRef[], enabled = true) {
  const key = cidades
    .map((c) => `${c.cidade}|${c.estado}`)
    .sort()
    .join(';')

  return useQuery({
    queryKey: ['insights', 'populacao', key],
    enabled: enabled && cidades.length > 0,
    staleTime: STALE_MS,
    gcTime: STALE_MS,
    queryFn: async () => {
      const fromDb = await fetchPopulacaoFromDb(cidades)
      const missing = cidades.filter((c) => {
        if (!c.cidade?.trim() || !c.estado?.trim() || c.cidade.startsWith('—')) return false
        return !fromDb.has(cidadeUfKey(c.cidade, c.estado))
      })
      if (missing.length === 0) return fromDb
      const fromApi = await resolvePopulacaoCidades(missing)
      for (const [k, v] of fromApi) fromDb.set(k, v)
      return fromDb
    },
  })
}
