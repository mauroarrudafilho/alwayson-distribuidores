import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { InsightsProdutoDePara } from '@/types/insights'

export function useInsightsProdutoDePara() {
  return useQuery({
    queryKey: ['insights-produto-de-para'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('alwayson_insights_produto_de_para')
        .select('*')
        .order('codigo_origem')
      if (error) throw error
      return data as InsightsProdutoDePara[]
    },
  })
}

export function useUpsertInsightsProdutoDePara() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (args: {
      rows: Array<{ codigo_origem: string; sku_fornecedor: string }>
    }) => {
      const now = new Date().toISOString()
      const byOrigem = new Map<string, string>()
      for (const r of args.rows) {
        const o = r.codigo_origem.trim()
        if (!o) continue
        byOrigem.set(o, String(r.sku_fornecedor).trim())
      }
      const payloads = [...byOrigem.entries()].map(([codigo_origem, sku_fornecedor]) => ({
        codigo_origem,
        sku_fornecedor,
        ativo: true,
        atualizado_em: now,
      }))
      if (payloads.length === 0) return
      const { error } = await supabase
        .from('alwayson_insights_produto_de_para')
        .upsert(payloads, { onConflict: 'codigo_origem' })
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['insights-produto-de-para'] })
    },
  })
}
