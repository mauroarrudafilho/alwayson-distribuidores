import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { InsightsClienteMes, InsightsTopCliente } from '@/types/insights'
import {
  insightsCnpjKey,
  isoDateOnly,
  useInsightsClienteHistorico,
} from '@/hooks/useInsightsQueries'

import { parseInsightsClienteBrasilStatus } from '@/lib/insightsClienteBrasilStatus'

function n(x: unknown): number {
  const v = Number(x)
  return Number.isFinite(v) ? v : 0
}

function mapClienteRow(row: Record<string, unknown>): InsightsTopCliente {
  const rs = row.razao_social
  const razaoSocial =
    rs == null ? undefined : (() => {
      const t = String(rs).trim()
      return t || undefined
    })()
  return {
    cnpj_cliente: String(row.cnpj_cliente ?? ''),
    nome_cliente: String(row.nome_cliente ?? '—').trim() || '—',
    razao_social: razaoSocial,
    cidade: row.cidade != null ? String(row.cidade) : undefined,
    estado: row.estado != null ? String(row.estado) : undefined,
    faturamento_total: n(row.faturamento_total),
    total_nfs: Math.trunc(Number(row.total_nfs)) || 0,
    ultima_compra: isoDateOnly(row.ultima_compra),
    total_skus: Math.trunc(Number(row.total_skus)) || 0,
    nome_rede: (() => {
      const g = row.grupo_label
      if (g == null) return undefined
      const t = String(g).trim()
      return t || undefined
    })(),
    brasil_enriquecimento_status: parseInsightsClienteBrasilStatus(
      row.brasil_enriquecimento_status
    ),
  }
}

/**
 * Verifica se há sell-out territorial no Insights para este CNPJ.
 * Comparativo Sell-in vs Sell-out (popover InsightsBadge).
 */
export function useClienteEmInsights(cnpj: string | null | undefined) {
  const key = insightsCnpjKey(cnpj ?? '')
  const enabled = key.length === 14

  const summary = useQuery({
    queryKey: ['insights', 'cliente-resumo', key],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('alwayson_insights_v_clientes_com_rede')
        .select('*')
        .eq('cnpj_cliente', key)
        .maybeSingle()
      if (error) throw error
      return data as Record<string, unknown> | null
    },
  })

  const hasCliente = enabled && summary.isSuccess && !!summary.data
  const hist = useInsightsClienteHistorico(hasCliente ? key : undefined)

  return useMemo(() => {
    if (!enabled)
      return { existe: false as const }

    if (summary.isPending)
      return { existe: false as const }

    if (summary.error)
      return { existe: false as const }

    const row = summary.data
    if (!row)
      return { existe: false as const }

    const cliente = mapClienteRow(row)
    const historico: InsightsClienteMes[] = hist.data ?? []
    const ultimoMes = historico[historico.length - 1]

    return {
      existe: true as const,
      cliente,
      historico,
      ultimoMes,
    }
  }, [
    enabled,
    summary.isPending,
    summary.error,
    summary.data,
    hist.data,
  ])
}
