import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type {
  InsightsProdutoDePara,
  InsightsProdutoDesconsiderado,
  InsightsProdutoNaoMapeado,
} from '@/types/insights'

function n(x: unknown): number {
  const v = Number(x)
  return Number.isFinite(v) ? v : 0
}

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

/** Códigos com sell-out Insights que ainda não resolvem para alwayson_produtos. */
export function useInsightsProdutosNaoMapeados(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['insights-produto-nao-mapeados'],
    staleTime: 30_000,
    enabled: options?.enabled !== false,
    queryFn: async (): Promise<InsightsProdutoNaoMapeado[]> => {
      const { data, error } = await supabase
        .from('alwayson_insights_v_produtos_nao_mapeados')
        .select('*')
        .order('faturamento_total', { ascending: false })
        .limit(500)
      if (error) throw error
      return (data ?? []).map((row) => ({
        codigo_origem: String((row as { codigo_origem: string }).codigo_origem ?? ''),
        sku_exemplo: String((row as { sku_exemplo: string | null }).sku_exemplo ?? ''),
        descricao: String((row as { descricao: string | null }).descricao ?? ''),
        sku_resolvido_atual: String(
          (row as { sku_resolvido_atual: string | null }).sku_resolvido_atual ?? ''
        ),
        faturamento_total: n((row as { faturamento_total: unknown }).faturamento_total),
        quantidade_total: n((row as { quantidade_total: unknown }).quantidade_total),
        total_linhas: Math.trunc(Number((row as { total_linhas: unknown }).total_linhas)) || 0,
      }))
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
      void qc.invalidateQueries({ queryKey: ['insights-produto-nao-mapeados'] })
      void qc.invalidateQueries({ queryKey: ['insights'] })
    },
  })
}

export function useInsightsProdutosDesconsiderados() {
  return useQuery({
    queryKey: ['insights-produto-desconsiderados'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('alwayson_insights_produto_desconsiderados')
        .select('id, codigo_origem, motivo, criado_em')
        .order('criado_em', { ascending: false })
      if (error) throw error
      return (data ?? []) as InsightsProdutoDesconsiderado[]
    },
  })
}

export function useDesconsiderarInsightsProduto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (args: { codigo_origem: string; motivo?: string }) => {
      const codigo = args.codigo_origem.trim()
      if (!codigo) return
      const { error } = await supabase.from('alwayson_insights_produto_desconsiderados').upsert(
        {
          codigo_origem: codigo,
          motivo: args.motivo?.trim() || null,
        },
        { onConflict: 'codigo_origem' }
      )
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['insights-produto-desconsiderados'] })
      void qc.invalidateQueries({ queryKey: ['insights-produto-nao-mapeados'] })
    },
  })
}

export function useRestaurarInsightsProduto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (codigo_origem: string) => {
      const codigo = codigo_origem.trim()
      if (!codigo) return
      const { error } = await supabase
        .from('alwayson_insights_produto_desconsiderados')
        .delete()
        .eq('codigo_origem', codigo)
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['insights-produto-desconsiderados'] })
      void qc.invalidateQueries({ queryKey: ['insights-produto-nao-mapeados'] })
    },
  })
}
