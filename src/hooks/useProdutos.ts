import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Produto } from '@/types/produto'

export function useProdutos() {
  return useQuery({
    queryKey: ['produtos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('alwayson_produtos')
        .select('*')
        .order('sku')
      if (error) throw error
      return data as Produto[]
    },
  })
}
