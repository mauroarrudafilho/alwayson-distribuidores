import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { ExcelenciaConfig, ExcelenciaCliente } from '@/types/excelencia'
import type { ClienteDistribuidor } from '@/types/distribuidor'

export function useExcelenciaConfigs(distribuidorId?: string) {
  return useQuery({
    queryKey: ['excelencia-config', distribuidorId ?? 'all'],
    queryFn: async () => {
      let query = supabase
        .from('alwayson_excelencia_config')
        .select('*')
        .eq('ativo', true)
        .order('ordem')
      if (distribuidorId) query = query.eq('distribuidor_id', distribuidorId)
      const { data, error } = await query
      if (error) throw error
      return data as ExcelenciaConfig[]
    },
  })
}

export function useExcelenciaClientes(distribuidorId?: string) {
  return useQuery({
    queryKey: ['excelencia-clientes', distribuidorId ?? 'all'],
    queryFn: async () => {
      let query = supabase
        .from('alwayson_excelencia_clientes')
        .select(`
          *,
          cliente:alwayson_clientes_distribuidor(*)
        `)
        .eq('ativo', true)
      if (distribuidorId) query = query.eq('distribuidor_id', distribuidorId)
      const { data, error } = await query
      if (error) throw error
      return data as (ExcelenciaCliente & { cliente: ClienteDistribuidor })[]
    },
  })
}
