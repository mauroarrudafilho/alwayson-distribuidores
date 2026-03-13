import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { PerformancePeriodo, Vendedor } from '@/types/distribuidor'

export function useVendedores(distribuidorId: string | undefined) {
  return useQuery({
    queryKey: ['vendedores', distribuidorId],
    queryFn: async () => {
      if (!distribuidorId) throw new Error('ID required')
      const { data, error } = await supabase
        .from('alwayson_vendedores_distribuidor')
        .select('*')
        .eq('distribuidor_id', distribuidorId)
        .eq('ativo', true)
        .order('nome')
      if (error) throw error
      return data as Vendedor[]
    },
    enabled: !!distribuidorId,
  })
}

export function usePerformance(distribuidorId: string | undefined) {
  return useQuery({
    queryKey: ['performance', distribuidorId],
    queryFn: async () => {
      if (!distribuidorId) throw new Error('ID required')
      const { data, error } = await supabase
        .from('alwayson_performance_periodo')
        .select('*')
        .eq('distribuidor_id', distribuidorId)
        .order('periodo_inicio', { ascending: false })
      if (error) throw error
      return data as PerformancePeriodo[]
    },
    enabled: !!distribuidorId,
  })
}

export function useAllPerformance() {
  return useQuery({
    queryKey: ['performance', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('alwayson_performance_periodo')
        .select('*')
        .order('periodo_inicio', { ascending: false })
      if (error) throw error
      return data as PerformancePeriodo[]
    },
  })
}
