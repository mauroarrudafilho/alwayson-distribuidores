import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { DistribuidorKPIs } from '@/types/distribuidor'

function getMonthBoundaries() {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth()
  const currentStart = new Date(currentYear, currentMonth, 1)
  const currentEnd = new Date(currentYear, currentMonth + 1, 0)
  const prevStart = new Date(currentYear, currentMonth - 1, 1)
  const prevEnd = new Date(currentYear, currentMonth, 0)
  return { currentStart, currentEnd, prevStart, prevEnd }
}

function isInPeriod(periodoInicio: string, start: Date, end: Date): boolean {
  const d = new Date(periodoInicio)
  return d >= start && d <= end
}

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
          .in('status', ['critico']),
        supabase
          .from('alwayson_metas_distribuidor')
          .select('id, valor_meta, valor_realizado, percentual_atingimento'),
        supabase
          .from('alwayson_performance_periodo')
          .select('distribuidor_id, periodo_inicio, faturamento, clientes_positivados, total_clientes_carteira'),
      ])

      const distribuidores = distribuidoresRes.data ?? []
      const clientes = clientesRes.data ?? []
      const estoqueCritico = estoqueRes.data ?? []
      const metas = metasRes.data ?? []
      const performance = performanceRes.data ?? []

      const { currentStart, currentEnd, prevStart, prevEnd } = getMonthBoundaries()

      const currentPeriod = performance.filter((p) =>
        p.periodo_inicio && isInPeriod(p.periodo_inicio, currentStart, currentEnd)
      )
      const prevPeriod = performance.filter((p) =>
        p.periodo_inicio && isInPeriod(p.periodo_inicio, prevStart, prevEnd)
      )

      const faturamentoAtual = currentPeriod.reduce(
        (sum, p) => sum + Number(p.faturamento),
        0
      )
      const faturamentoAnterior = prevPeriod.reduce(
        (sum, p) => sum + Number(p.faturamento),
        0
      )
      const variacaoPercentual =
        faturamentoAnterior > 0
          ? ((faturamentoAtual - faturamentoAnterior) / faturamentoAnterior) * 100
          : faturamentoAtual > 0 ? 100 : 0

      const totalPositivados = currentPeriod.reduce(
        (sum, p) => sum + (p.clientes_positivados ?? 0),
        0
      )
      const totalCarteira = currentPeriod.reduce(
        (sum, p) => sum + (p.total_clientes_carteira ?? 0),
        0
      )

      const rankingMap = new Map<string, number>()
      for (const p of currentPeriod) {
        const id = p.distribuidor_id ?? ''
        if (!id) continue
        rankingMap.set(id, (rankingMap.get(id) ?? 0) + Number(p.faturamento))
      }
      const rankingDistribuidores = Array.from(rankingMap.entries())
        .map(([distribuidor_id, faturamento]) => ({ distribuidor_id, faturamento }))
        .sort((a, b) => b.faturamento - a.faturamento)

      const clientesExcelencia = clientes.filter((c) => c.plano_excelencia)
      const metasAtingidas = metas.filter(
        (m) => Number(m.percentual_atingimento) >= 100
      )

      const kpis: DistribuidorKPIs = {
        faturamento_periodo: faturamentoAtual,
        faturamento_periodo_anterior: faturamentoAnterior,
        variacao_percentual: variacaoPercentual,
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
        rankingDistribuidores,
      }
    },
  })
}
