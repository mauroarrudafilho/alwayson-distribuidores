import { useMemo } from 'react'
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

/** Itens de várias NFs de uma vez (modal / export). */
export function useFaturamentoItensBatch(faturamentoIds: string[], enabled: boolean) {
  const key = useMemo(() => [...faturamentoIds].sort().join(','), [faturamentoIds])
  return useQuery({
    queryKey: ['faturamento-itens-batch', key],
    enabled: enabled && faturamentoIds.length > 0,
    queryFn: async () => {
      const map = new Map<string, FaturamentoItem[]>()
      for (let i = 0; i < faturamentoIds.length; i += 200) {
        const slice = faturamentoIds.slice(i, i + 200)
        const { data, error } = await supabase
          .from('alwayson_faturamento_itens')
          .select('*')
          .in('faturamento_id', slice)
          .order('sku')
        if (error) throw error
        for (const row of (data ?? []) as FaturamentoItem[]) {
          const list = map.get(row.faturamento_id) ?? []
          list.push(row)
          map.set(row.faturamento_id, list)
        }
      }
      return map
    },
  })
}

/** @deprecated Prefer useClienteMensalCompleto */
export function useClienteFaturamentoMensal(clienteId: string | undefined) {
  const q = useClienteMensalCompleto(clienteId)
  return {
    ...q,
    data: q.data?.map((r) => ({ month: r.month, total: r.faturamento })),
  }
}

export function useClienteMensalCompleto(clienteId: string | undefined) {
  return useQuery({
    queryKey: ['cliente-mensal-completo', clienteId],
    queryFn: async () => {
      if (!clienteId) throw new Error('clienteId required')
      const { data: fats, error } = await supabase
        .from('alwayson_faturamento')
        .select('id, data_emissao, valor_total')
        .eq('cliente_id', clienteId)
        .order('data_emissao')
      if (error) throw error
      if (!fats?.length) return []

      const byMonth = new Map<string, { faturamento: number; quantidade: number }>()
      const fatMonth = new Map<string, string>()
      for (const f of fats) {
        const month = f.data_emissao.substring(0, 7)
        fatMonth.set(f.id, month)
        const cur = byMonth.get(month) ?? { faturamento: 0, quantidade: 0 }
        cur.faturamento += Number(f.valor_total)
        byMonth.set(month, cur)
      }

      const fatIds = fats.map((f) => f.id as string)
      for (let i = 0; i < fatIds.length; i += 200) {
        const slice = fatIds.slice(i, i + 200)
        const { data: itens, error: iErr } = await supabase
          .from('alwayson_faturamento_itens')
          .select('faturamento_id, quantidade')
          .in('faturamento_id', slice)
        if (iErr) throw iErr
        for (const row of itens ?? []) {
          const month = fatMonth.get(row.faturamento_id as string)
          if (!month) continue
          const cur = byMonth.get(month)!
          cur.quantidade += Number(row.quantidade) || 0
        }
      }

      return Array.from(byMonth.entries())
        .map(([month, v]) => ({
          month,
          faturamento: v.faturamento,
          quantidade: v.quantidade,
        }))
        .sort((a, b) => a.month.localeCompare(b.month))
    },
    enabled: !!clienteId,
  })
}
