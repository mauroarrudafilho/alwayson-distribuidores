import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { ClienteDistribuidor, ExcelenciaCriterio } from '@/types/distribuidor'

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

export function useClientesExcelencia() {
  return useQuery({
    queryKey: ['clientes', 'excelencia'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('alwayson_clientes_distribuidor')
        .select('*')
        .eq('plano_excelencia', true)
        .order('razao_social')
      if (error) throw error
      return data as ClienteDistribuidor[]
    },
  })
}

export function useExcelenciaCriterios(clienteId: string | undefined) {
  return useQuery({
    queryKey: ['excelencia_criterios', clienteId],
    queryFn: async () => {
      if (!clienteId) throw new Error('ID required')
      const { data, error } = await supabase
        .from('alwayson_excelencia_criterios')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('periodo', { ascending: false })
      if (error) throw error
      return data as ExcelenciaCriterio[]
    },
    enabled: !!clienteId,
  })
}
