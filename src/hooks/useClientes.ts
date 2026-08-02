import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { ClienteDistribuidor } from '@/types/distribuidor'

/** Carteira completa de um distribuidor. */
export function useClientes(distribuidorId: string | undefined) {
  return useQuery({
    queryKey: ['clientes', distribuidorId],
    queryFn: async () => {
      if (!distribuidorId) throw new Error('ID required')
      const { data, error } = await supabase
        .from('alwayson_clientes_distribuidor')
        .select('*')
        .eq('distribuidor_id', distribuidorId)
        .order('razao_social')
      if (error) throw error
      return data as ClienteDistribuidor[]
    },
    enabled: !!distribuidorId,
  })
}
