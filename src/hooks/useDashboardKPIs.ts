import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { DistribuidorKPIs } from '@/types/distribuidor'

export function useDashboardKPIs() {
  return useQuery({
    queryKey: ['dashboard-kpis'],
    queryFn: async () => {
      const [
        distribuidoresRes,
        clientesRes,
        estoqueRes,
        metasRes,
        performanceRes,
      ] = await Promise.all([
        supabase
          .from('alwayson_distribuidores')
          .select('id, status')
          .eq('status', 'ativo'),
        supabase
          .from('alwayson_clientes_distribuidor')
          .select('id, plano_excelencia, status'),
        supabase
          .from('alwayson_estoque_distribuidor')
          .select('id, status')
          .in('status', ['critico', 'ruptura']),
        supabase
          .from('alwayson_metas_distribuidor')
          .select('id, valor_meta, valor_realizado, percentual_atingimento'),
        supabase
          .from('alwayson_performance_periodo')
          .select('faturamento, clientes_positivados, total_clientes_carteira'),
      ])

      const distribuidores = distribuidoresRes.data ?? []
      const clientes = clientesRes.data ?? []
      const estoqueCritico = estoqueRes.data ?? []
      const metas = metasRes.data ?? []
      const performance = performanceRes.data ?? []

      const totalFaturamento = performance.reduce(
        (sum, p) => sum + Number(p.faturamento),
        0
      )
      const totalPositivados = performance.reduce(
        (sum, p) => sum + (p.clientes_positivados ?? 0),
        0
      )
      const totalCarteira = performance.reduce(
        (sum, p) => sum + (p.total_clientes_carteira ?? 0),
        0
      )
      const clientesExcelencia = clientes.filter((c) => c.plano_excelencia)
      const metasAtingidas = metas.filter(
        (m) => Number(m.percentual_atingimento) >= 100
      )

      const kpis: DistribuidorKPIs = {
        faturamento_periodo: totalFaturamento,
        faturamento_periodo_anterior: 0,
        variacao_percentual: 0,
        clientes_positivados: totalPositivados,
        total_clientes_carteira: totalCarteira,
        taxa_positivacao:
          totalCarteira > 0 ? (totalPositivados / totalCarteira) * 100 : 0,
        clientes_excelencia_ativos: clientesExcelencia.filter(
          (c) => c.status === 'ativo'
        ).length,
        clientes_excelencia_total: clientesExcelencia.length,
        metas_atingidas: metasAtingidas.length,
        total_metas: metas.length,
        itens_estoque_critico: estoqueCritico.length,
      }

      return {
        kpis,
        distribuidoresAtivos: distribuidores.length,
      }
    },
  })
}
