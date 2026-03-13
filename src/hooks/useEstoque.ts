import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { EstoqueItem } from '@/types/distribuidor'

export function useEstoque(distribuidorId?: string) {
  return useQuery({
    queryKey: ['estoque', distribuidorId ?? 'all'],
    queryFn: async () => {
      let query = supabase
        .from('alwayson_estoque_distribuidor')
        .select('*')
        .order('status', { ascending: true })

      if (distribuidorId) {
        query = query.eq('distribuidor_id', distribuidorId)
      }

      const { data, error } = await query
      if (error) throw error
      return data as EstoqueItem[]
    },
  })
}
