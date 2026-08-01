import { useQuery } from '@tanstack/react-query'
import {
  aggregateSales,
  aggregateSalesBy,
} from '@/lib/faturamentoAgg'
import { loadFaturamentoSales } from '@/lib/loadFaturamentoSales'
import { monthEnd, monthStart } from '@/lib/periodo'
import type { PerformancePeriodo } from '@/types/distribuidor'

export { loadFaturamentoSales, aggregateSales, aggregateSalesBy }

/** Linhas de venda (NF + SKUs) no período — base para KPIs distintos. */
export function useFaturamentoSales(
  distribuidorId: string | undefined,
  periodoInicio?: string,
  periodoFim?: string
) {
  return useQuery({
    queryKey: ['faturamento-sales', distribuidorId ?? 'all', periodoInicio, periodoFim],
    queryFn: () =>
      loadFaturamentoSales({
        distribuidorId,
        periodoInicio,
        periodoFim,
      }),
    enabled: distribuidorId !== undefined ? !!distribuidorId : true,
  })
}

/**
 * Compatível com as abas de Performance: um “registro de performance”
 * sintético por vendedor, derivado de faturamento (positivados/itens distintos).
 */
export function usePerformanceFromFaturamento(
  distribuidorId: string | undefined,
  periodoInicio?: string,
  periodoFim?: string
) {
  return useQuery({
    queryKey: [
      'performance-from-faturamento',
      distribuidorId,
      periodoInicio,
      periodoFim,
    ],
    queryFn: async () => {
      if (!distribuidorId) throw new Error('distribuidorId required')
      const sales = await loadFaturamentoSales({
        distribuidorId,
        periodoInicio,
        periodoFim,
      })
      const byVend = aggregateSalesBy(sales, (r) => r.vendedor_id)
      const periodo_inicio = periodoInicio
        ? monthStart(periodoInicio)
        : (sales[0]?.data_emissao ?? '')
      const periodo_fim = periodoFim
        ? monthEnd(periodoFim)
        : (sales[sales.length - 1]?.data_emissao ?? '')

      const rows: PerformancePeriodo[] = []
      for (const [vendedor_id, agg] of byVend) {
        rows.push({
          id: `${distribuidorId}:${vendedor_id}:${periodo_inicio}`,
          distribuidor_id: distribuidorId,
          vendedor_id,
          periodo_inicio,
          periodo_fim,
          faturamento: agg.faturamento,
          clientes_positivados: agg.clientes_positivados,
          total_clientes_carteira: 0,
          itens_vendidos: agg.itens_vendidos,
          pedidos_realizados: agg.pedidos_realizados,
          criado_em: '',
        })
      }
      return { sales, byVendedor: rows }
    },
    enabled: !!distribuidorId,
  })
}

export function useAllFaturamentoSales(periodoInicio?: string, periodoFim?: string) {
  return useQuery({
    queryKey: ['faturamento-sales', 'all', periodoInicio, periodoFim],
    queryFn: () => loadFaturamentoSales({ periodoInicio, periodoFim }),
  })
}
