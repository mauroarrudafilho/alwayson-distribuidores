import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Faturamento, FaturamentoItem } from '@/types/faturamento'

export function useFaturamento(clienteId: string | undefined) {
  return useQuery({
    queryKey: ['faturamento', clienteId],
    queryFn: async () => {
      if (!clienteId) throw new Error('clienteId required')
      const { data, error } = await supabase
        .from('alwayson_faturamento')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('data_emissao', { ascending: false })
      if (error) throw error
      return data as Faturamento[]
    },
    enabled: !!clienteId,
  })
}

export function useFaturamentoItens(faturamentoId: string | undefined) {
  return useQuery({
    queryKey: ['faturamento-itens', faturamentoId],
    queryFn: async () => {
      if (!faturamentoId) throw new Error('faturamentoId required')
      const { data, error } = await supabase
        .from('alwayson_faturamento_itens')
        .select('*')
        .eq('faturamento_id', faturamentoId)
        .order('sku')
      if (error) throw error
      return data as FaturamentoItem[]
    },
    enabled: !!faturamentoId,
  })
}

export function useClienteFaturamentoMensal(clienteId: string | undefined) {
  return useQuery({
    queryKey: ['cliente-faturamento-mensal', clienteId],
    queryFn: async () => {
      if (!clienteId) throw new Error('clienteId required')
      const { data, error } = await supabase
        .from('alwayson_faturamento')
        .select('data_emissao, valor_total')
        .eq('cliente_id', clienteId)
        .order('data_emissao')
      if (error) throw error

      const monthly = new Map<string, number>()
      for (const row of data ?? []) {
        const month = row.data_emissao.substring(0, 7)
        monthly.set(month, (monthly.get(month) ?? 0) + Number(row.valor_total))
      }

      return Array.from(monthly.entries())
        .map(([month, total]) => ({ month, total }))
        .sort((a, b) => a.month.localeCompare(b.month))
    },
    enabled: !!clienteId,
  })
}
