import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { ExcelenciaConfig, ExcelenciaCliente } from '@/types/excelencia'
import type { ClienteDistribuidor } from '@/types/distribuidor'

export function useExcelenciaConfigs(distribuidorId?: string, includeInactive?: boolean) {
  return useQuery({
    queryKey: ['excelencia-config', distribuidorId ?? 'all', includeInactive],
    queryFn: async () => {
      let query = supabase
        .from('alwayson_excelencia_config')
        .select('*')
        .order('ordem')
      if (!includeInactive) query = query.eq('ativo', true)
      if (distribuidorId) query = query.eq('distribuidor_id', distribuidorId)
      const { data, error } = await query
      if (error) throw error
      return data as ExcelenciaConfig[]
    },
  })
}

export function useExcelenciaClientes(distribuidorId?: string, includeInactive?: boolean) {
  return useQuery({
    queryKey: ['excelencia-clientes', distribuidorId ?? 'all', includeInactive],
    queryFn: async () => {
      let query = supabase
        .from('alwayson_excelencia_clientes')
        .select(`
          *,
          cliente:alwayson_clientes_distribuidor(*)
        `)
      if (!includeInactive) query = query.eq('ativo', true)
      if (distribuidorId) query = query.eq('distribuidor_id', distribuidorId)
      const { data, error } = await query
      if (error) throw error
      return data as (ExcelenciaCliente & { cliente: ClienteDistribuidor })[]
    },
  })
}
