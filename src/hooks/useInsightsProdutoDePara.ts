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
      const payloads = args.rows.map((r) => ({
        codigo_origem: r.codigo_origem.trim(),
        sku_fornecedor: String(r.sku_fornecedor).trim(),
        ativo: true,
        atualizado_em: now,
      }))
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
