import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { insightsCnpjKey } from '@/hooks/useInsightsQueries'
import { monthEnd, monthStart } from '@/lib/periodo'

export type LocalMixSku = {
  sku: string
  descricao: string
  quantidade_total: number
  faturamento_total: number
}

/** Um mês `YYYY-MM` (Performance) ou intervalo fechado (Insights ciclo vivo). */
export type MixLocalPeriodo = string | { inicio: string; fim: string }

function periodoBounds(periodo?: MixLocalPeriodo): { start?: string; end?: string } {
  if (!periodo) return {}
  if (typeof periodo === 'string') {
    return { start: monthStart(periodo), end: monthEnd(periodo) }
  }
  return { start: monthStart(periodo.inicio), end: monthEnd(periodo.fim) }
}

export function useClienteMixLocal(
  cnpj: string | undefined,
  enabled: boolean,
  periodo?: MixLocalPeriodo
) {
  const key = cnpj ? insightsCnpjKey(cnpj) : ''
  const bounds = periodoBounds(periodo)
  const periodoKey =
    typeof periodo === 'string'
      ? periodo
      : periodo
        ? `${periodo.inicio}_${periodo.fim}`
        : 'all'

  return useQuery({
    queryKey: ['cliente-mix-local', key, periodoKey],
    enabled: enabled && key.length === 14,
    queryFn: async (): Promise<LocalMixSku[]> => {
      const { data: clientes, error: cErr } = await supabase
        .from('alwayson_clientes_distribuidor')
        .select('id')
        .eq('cnpj', key)
      if (cErr) throw cErr
      if (!clientes?.length) return []

      const clienteIds = clientes.map((c) => c.id as string)
      let fatQuery = supabase
        .from('alwayson_faturamento')
        .select('id')
        .in('cliente_id', clienteIds)

      if (bounds.start && bounds.end) {
        fatQuery = fatQuery.gte('data_emissao', bounds.start).lte('data_emissao', bounds.end)
      }

      const { data: fats, error: fErr } = await fatQuery
      if (fErr) throw fErr
      if (!fats?.length) return []

      const fatIds = fats.map((f) => f.id as string)
      const skuMap = new Map<string, LocalMixSku>()

      for (let i = 0; i < fatIds.length; i += 200) {
        const slice = fatIds.slice(i, i + 200)
        const { data: itens, error: iErr } = await supabase
          .from('alwayson_faturamento_itens')
          .select('sku, descricao, quantidade, valor_total')
          .in('faturamento_id', slice)
        if (iErr) throw iErr
        for (const row of itens ?? []) {
          const sku = String(row.sku)
          const existing = skuMap.get(sku)
          const qtd = Number(row.quantidade) || 0
          const fat = Number(row.valor_total) || 0
          if (existing) {
            existing.quantidade_total += qtd
            existing.faturamento_total += fat
          } else {
            skuMap.set(sku, {
              sku,
              descricao: String(row.descricao ?? sku),
              quantidade_total: qtd,
              faturamento_total: fat,
            })
          }
        }
      }

      return [...skuMap.values()].sort((a, b) => b.faturamento_total - a.faturamento_total)
    },
  })
}
