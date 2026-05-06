import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Vendedor, PerformancePeriodo, Meta } from '@/types/distribuidor'
import type { PerfTab } from '@/pages/performance/usePerfFilters'

export function useVendedorHierarchy(distribuidorId: string | undefined) {
  return useQuery({
    queryKey: ['vendedor-hierarchy', distribuidorId],
    queryFn: async () => {
      if (!distribuidorId) throw new Error('distribuidorId required')
      const { data, error } = await supabase
        .from('alwayson_vendedores_distribuidor')
        .select('*')
        .eq('distribuidor_id', distribuidorId)
        .eq('ativo', true)
      if (error) throw error

      const vendedores = data as Vendedor[]
      const gerentes = vendedores.filter((v) => v.tipo === 'gerente')
      const supervisores = vendedores.filter((v) => v.tipo === 'supervisor')
      const vendedoresOnly = vendedores.filter((v) => v.tipo === 'vendedor')

      const availableLevels: PerfTab[] = ['distribuidor']
      if (gerentes.length > 0) availableLevels.push('gerencia')
      if (supervisores.length > 0) availableLevels.push('supervisao')
      availableLevels.push('vendas', 'cliente')

      function getSubordinateIds(parentId: string): string[] {
        const directs = vendedores.filter((v) => v.supervisor_id === parentId)
        return directs.flatMap((d) => [d.id, ...getSubordinateIds(d.id)])
      }

      return {
        vendedores,
        gerentes,
        supervisores,
        vendedoresOnly,
        availableLevels,
        getSubordinateIds,
      }
    },
    enabled: !!distribuidorId,
  })
}

export function usePerformanceByLevel(
  distribuidorId: string | undefined,
  periodoInicio?: string,
  periodoFim?: string
) {
  return useQuery({
    queryKey: ['performance-level', distribuidorId, periodoInicio, periodoFim],
    queryFn: async () => {
      if (!distribuidorId) throw new Error('distribuidorId required')
      let query = supabase
        .from('alwayson_performance_periodo')
        .select('*')
        .eq('distribuidor_id', distribuidorId)

      if (periodoInicio) query = query.gte('periodo_inicio', periodoInicio)
      if (periodoFim) query = query.lte('periodo_fim', periodoFim)

      const { data, error } = await query
      if (error) throw error
      return data as PerformancePeriodo[]
    },
    enabled: !!distribuidorId,
  })
}

export function useMetasByLevel(
  distribuidorId: string | undefined,
  hierarquia?: Meta['hierarquia'],
  vendedorId?: string
) {
  return useQuery({
    queryKey: ['metas-level', distribuidorId, hierarquia, vendedorId],
    queryFn: async () => {
      let query = supabase
        .from('alwayson_metas_distribuidor')
        .select('*')
        .order('periodo_inicio', { ascending: false })

      if (distribuidorId) query = query.eq('distribuidor_id', distribuidorId)
      if (hierarquia) query = query.eq('hierarquia', hierarquia)
      if (vendedorId) query = query.eq('vendedor_id', vendedorId)

      const { data, error } = await query
      if (error) throw error
      return data as Meta[]
    },
    enabled: !!distribuidorId,
  })
}
