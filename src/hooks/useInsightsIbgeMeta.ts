import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { cidadeUfKey, normalizeMunicipioNome } from '@/lib/ibge-populacao'

const STALE_MS = 7 * 24 * 60 * 60 * 1000
const ANO_REF = 2022

export type IbgeMunicipioMeta = {
  cidade_norm: string
  estado: string
  codigo_ibge: number
  populacao: number
}

/** Meta IBGE (código + população) por UF — para mapa municipal e per capita. */
export function useInsightsIbgeMeta(estados: string[], enabled = true) {
  const ufs = [...new Set(estados.map((e) => e.toUpperCase().trim()).filter(Boolean))].sort()

  return useQuery({
    queryKey: ['insights', 'ibge-meta', ufs.join(',')],
    enabled: enabled && ufs.length > 0,
    staleTime: STALE_MS,
    gcTime: STALE_MS,
    queryFn: async () => {
      const byKey = new Map<string, IbgeMunicipioMeta>()
      const byCodigo = new Map<number, IbgeMunicipioMeta>()

      const { data, error } = await supabase
        .from('alwayson_ibge_municipio_populacao')
        .select('cidade_norm, estado, codigo_ibge, populacao')
        .eq('ano_referencia', ANO_REF)
        .in('estado', ufs)

      if (error) {
        const msg = String(error.message ?? '')
        if (msg.includes('does not exist') || msg.includes('schema cache')) {
          return { byKey, byCodigo }
        }
        throw error
      }

      for (const row of data ?? []) {
        const r = row as {
          cidade_norm: string
          estado: string
          codigo_ibge: number
          populacao: number
        }
        const estado = String(r.estado).toUpperCase()
        const cidade_norm = normalizeMunicipioNome(r.cidade_norm)
        const meta: IbgeMunicipioMeta = {
          cidade_norm,
          estado,
          codigo_ibge: Number(r.codigo_ibge),
          populacao: Number(r.populacao),
        }
        if (!Number.isFinite(meta.codigo_ibge) || meta.populacao <= 0) continue
        byKey.set(`${cidade_norm}\t${estado}`, meta)
        byCodigo.set(meta.codigo_ibge, meta)
      }

      return { byKey, byCodigo }
    },
  })
}

export function lookupIbgeMeta(
  byKey: Map<string, IbgeMunicipioMeta> | undefined,
  cidade: string,
  estado: string
): IbgeMunicipioMeta | undefined {
  if (!byKey) return undefined
  return byKey.get(cidadeUfKey(cidade, estado))
}
