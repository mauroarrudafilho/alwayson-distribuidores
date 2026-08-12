import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { DistribuidorProdutoDePara, DistribuidorProdutoNaoMapeado } from '@/types/distribuidor'

function n(x: unknown): number {
  const v = Number(x)
  return Number.isFinite(v) ? v : 0
}

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

/** SKUs brutos do distribuidor faturados sem produto_id e sem entrada no de-para dele — fila de curadoria. */
export function useDistribuidorProdutosNaoMapeados(distribuidorId: string | undefined) {
  return useQuery({
    queryKey: ['distribuidor-produtos-nao-mapeados', distribuidorId],
    staleTime: 30_000,
    enabled: !!distribuidorId,
    queryFn: async (): Promise<DistribuidorProdutoNaoMapeado[]> => {
      if (!distribuidorId) return []
      const { data, error } = await supabase
        .from('alwayson_faturamento_v_distribuidor_produtos_nao_mapeados')
        .select('*')
        .eq('distribuidor_id', distribuidorId)
        .order('faturamento_total', { ascending: false })
        .limit(500)
      if (error) throw error
      return (data ?? []).map((row) => {
        const r = row as Record<string, unknown>
        return {
          sku: String(r.sku ?? ''),
          descricao: String(r.descricao ?? ''),
          faturamento_total: n(r.faturamento_total),
          total_linhas: Math.trunc(n(r.total_linhas)),
        }
      })
    },
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
      void qc.invalidateQueries({
        queryKey: ['distribuidor-produtos-nao-mapeados', vars.distribuidor_id],
      })
    },
  })
}
