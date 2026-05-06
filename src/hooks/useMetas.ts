import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Meta } from '@/types/distribuidor'

export function useMetas() {
  return useQuery({
    queryKey: ['metas-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('alwayson_metas_distribuidor')
        .select('*, alwayson_distribuidores(nome), alwayson_vendedores_distribuidor(nome)')
        .order('periodo_inicio', { ascending: false })
      if (error) throw error
      return data as (Meta & { alwayson_distribuidores: { nome: string } | null, alwayson_vendedores_distribuidor: { nome: string } | null })[]
    },
  })
}
