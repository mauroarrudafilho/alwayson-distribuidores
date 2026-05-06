import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Distribuidor } from '@/types/distribuidor'

export function useDistribuidores() {
  return useQuery({
    queryKey: ['distribuidores'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('alwayson_distribuidores')
        .select('*')
        .order('nome')
      if (error) throw error
      return data as Distribuidor[]
    },
  })
}

export function useDistribuidor(id: string | undefined) {
  return useQuery({
    queryKey: ['distribuidores', id],
    queryFn: async () => {
      if (!id) throw new Error('ID required')
      const { data, error } = await supabase
        .from('alwayson_distribuidores')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      return data as Distribuidor
    },
    enabled: !!id,
  })
}
