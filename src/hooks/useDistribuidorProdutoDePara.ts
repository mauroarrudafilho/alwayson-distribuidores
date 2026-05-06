import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { DistribuidorProdutoDePara } from '@/types/distribuidor'

export function useDistribuidorProdutoDePara(distribuidorId: string | undefined) {
  return useQuery({
    queryKey: ['distribuidor-produto-de-para', distribuidorId],
    queryFn: async () => {
      if (!distribuidorId) return []
      const { data, error } = await supabase
        .from('alwayson_distribuidor_produto_de_para')
        .select('*')
        .eq('distribuidor_id', distribuidorId)
        .order('codigo_cliente')
      if (error) throw error
      return data as DistribuidorProdutoDePara[]
    },
    enabled: !!distribuidorId,
  })
}

export function useUpsertDistribuidorProdutoDePara() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (args: {
      distribuidor_id: string
      rows: Array<{ codigo_cliente: string; sku_fornecedor: string }>
    }) => {
      const now = new Date().toISOString()
      const payloads = args.rows.map((r) => ({
        distribuidor_id: args.distribuidor_id,
        codigo_cliente: r.codigo_cliente.trim(),
        sku_fornecedor: String(r.sku_fornecedor).trim(),
        ativo: true,
        atualizado_em: now,
      }))
      const { error } = await supabase
        .from('alwayson_distribuidor_produto_de_para')
        .upsert(payloads, { onConflict: 'distribuidor_id,codigo_cliente' })
      if (error) throw error
    },
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({
        queryKey: ['distribuidor-produto-de-para', vars.distribuidor_id],
      })
    },
  })
}
