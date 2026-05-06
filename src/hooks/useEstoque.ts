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

export type EstoqueAlerta = EstoqueItem & { distribuidor_nome: string }

export function useEstoqueAlertas() {
  return useQuery({
    queryKey: ['estoque-alertas'],
    queryFn: async () => {
      const { data: items, error } = await supabase
        .from('alwayson_estoque_distribuidor')
        .select('*, alwayson_distribuidores(nome)')
        .in('status', ['critico', 'overstock'])
        .order('status', { ascending: true })
        .order('dias_cobertura', { ascending: true })

      if (error) throw error

      return (items ?? []).map((item: any) => ({
        ...item,
        distribuidor_nome: item.alwayson_distribuidores?.nome ?? '',
        alwayson_distribuidores: undefined,
      })) as EstoqueAlerta[]
    },
  })
}
