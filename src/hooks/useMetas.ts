import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Meta } from '@/types/distribuidor'

export function useMetas(distribuidorId?: string) {
  return useQuery({
    queryKey: ['metas', distribuidorId ?? 'all'],
    queryFn: async () => {
      let query = supabase
        .from('alwayson_metas_distribuidor')
        .select('*')
        .order('periodo_inicio', { ascending: false })

      if (distribuidorId) {
        query = query.eq('distribuidor_id', distribuidorId)
      }

      const { data, error } = await query
      if (error) throw error
      return data as Meta[]
    },
  })
}
