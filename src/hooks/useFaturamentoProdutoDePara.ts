import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { FaturamentoProdutoDePara, FaturamentoProdutoNaoMapeado } from '@/types/produto'

function n(x: unknown): number {
  const v = Number(x)
  return Number.isFinite(v) ? v : 0
}

export function useFaturamentoProdutoDePara() {
  return useQuery({
    queryKey: ['faturamento-produto-de-para'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('alwayson_faturamento_produto_de_para')
        .select('*')
        .order('sku_origem')
      if (error) throw error
      return data as FaturamentoProdutoDePara[]
    },
  })
}

/** SKUs faturados sem produto_id resolvido e sem alias — fila de curadoria em /admin/produtos. */
export function useFaturamentoProdutosNaoMapeados() {
  return useQuery({
    queryKey: ['faturamento-produtos-nao-mapeados'],
    staleTime: 30_000,
    queryFn: async (): Promise<FaturamentoProdutoNaoMapeado[]> => {
      const { data, error } = await supabase
        .from('alwayson_faturamento_v_produtos_nao_mapeados')
        .select('*')
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

export function useUpsertFaturamentoProdutoDePara() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (args: { sku_origem: string; sku_fornecedor: string }) => {
      const skuOrigem = args.sku_origem.trim()
      const skuFornecedor = args.sku_fornecedor.trim()
      if (!skuOrigem || !skuFornecedor) {
        throw new Error('sku_origem e sku_fornecedor são obrigatórios')
      }
      const { error } = await supabase
        .from('alwayson_faturamento_produto_de_para')
        .upsert({ sku_origem: skuOrigem, sku_fornecedor: skuFornecedor }, { onConflict: 'sku_origem' })
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['faturamento-produto-de-para'] })
      void qc.invalidateQueries({ queryKey: ['faturamento-produtos-nao-mapeados'] })
      void qc.invalidateQueries({ queryKey: ['serie-produto'] })
    },
  })
}

export function useDeleteFaturamentoProdutoDePara() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (skuOrigem: string) => {
      const sku = skuOrigem.trim()
      if (!sku) {
        throw new Error('sku_origem é obrigatório')
      }
      const { error } = await supabase
        .from('alwayson_faturamento_produto_de_para')
        .delete()
        .eq('sku_origem', sku)
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['faturamento-produto-de-para'] })
      void qc.invalidateQueries({ queryKey: ['faturamento-produtos-nao-mapeados'] })
      void qc.invalidateQueries({ queryKey: ['serie-produto'] })
    },
  })
}
