import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { insightsCnpjKey } from '@/hooks/useInsightsQueries'
import { isCidadeVazia } from '@/lib/cliente-cidade'

export type InsightsCidadeRef = { cidade: string; estado: string }

/** Mapa CNPJ14 → cidade/UF da dimensão Insights (`alwayson_insights_clientes`). */
export function useInsightsCidadesByCnpj(cnpjs: string[]) {
  const keys = useMemo(() => {
    const set = new Set<string>()
    for (const raw of cnpjs) {
      const k = insightsCnpjKey(raw)
      if (k.length === 14) set.add(k)
    }
    return [...set].sort()
  }, [cnpjs])

  const query = useQuery({
    queryKey: ['insights', 'cidades-by-cnpj', keys.join(',')],
    enabled: keys.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const map = new Map<string, InsightsCidadeRef>()
      for (let i = 0; i < keys.length; i += 100) {
        const chunk = keys.slice(i, i + 100)
        const { data, error } = await supabase
          .from('alwayson_insights_clientes')
          .select('cnpj_14, cidade, estado')
          .in('cnpj_14', chunk)
        if (error) throw error
        for (const row of data ?? []) {
          const cnpj = String(row.cnpj_14 ?? '')
          const cidade = row.cidade != null ? String(row.cidade).trim() : ''
          const estado = row.estado != null ? String(row.estado).trim() : ''
          if (cnpj.length === 14 && !isCidadeVazia(cidade, estado)) {
            map.set(cnpj, { cidade, estado })
          }
        }
      }
      return map
    },
  })

  return {
    cidadesMap: query.data ?? new Map<string, InsightsCidadeRef>(),
    isLoading: query.isPending,
  }
}
