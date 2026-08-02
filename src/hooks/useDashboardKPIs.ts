import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { aggregateSales, aggregateSalesBy } from '@/lib/faturamentoAgg'
import { loadFaturamentoSales } from '@/lib/loadFaturamentoSales'
import { getCurrentMonth, getMonthOffset, prevMonth } from '@/lib/periodo'
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
        estrategicosRes,
      ] = await Promise.all([
        supabase
          .from('alwayson_distribuidores')
          .select('id, status')
          .eq('status', 'ativo'),
        supabase
          .from('alwayson_clientes_distribuidor')
          .select('id, status, distribuidor_id'),
        supabase
          .from('alwayson_estoque_distribuidor')
          .select('id, status')
          .in('status', ['critico']),
        supabase
          // View: realizado/percentual derivados do faturamento (migration 045).
          .from('alwayson_metas_v_acompanhamento')
          .select('id, valor_meta, valor_realizado, percentual_atingimento'),
        // Lista curada (migration 052) — substitui a flag `plano_excelencia`,
        // que nunca foi alimentada pela ingestão.
        supabase
          .from('alwayson_clientes_estrategicos')
          .select('cliente_id, ativo')
          .eq('ativo', true),
      ])

      const distribuidores = distribuidoresRes.data ?? []
      const clientes = clientesRes.data ?? []
      const estoqueCritico = estoqueRes.data ?? []
      const metas = metasRes.data ?? []
      const estrategicos = estrategicosRes.data ?? []

      // Janela alinhada à Performance (trimestre rolling) + mês âncora = último com venda.
      const periodoFim = getCurrentMonth()
      const periodoInicio = getMonthOffset(2)
      const sales = await loadFaturamentoSales({ periodoInicio, periodoFim })

      let anchorMonth = periodoFim
      if (sales.length) {
        const months = sales.map((s) => s.data_emissao.slice(0, 7)).sort()
        anchorMonth = months[months.length - 1] ?? periodoFim
      }
      const prev = prevMonth(anchorMonth)

      const currentSales = sales.filter((s) => s.data_emissao.startsWith(anchorMonth))
      const prevSales = sales.filter((s) => s.data_emissao.startsWith(prev))

      const currentAgg = aggregateSales(currentSales)
      const prevAgg = aggregateSales(prevSales)

      const faturamentoAtual = currentAgg.faturamento
      const faturamentoAnterior = prevAgg.faturamento
      const variacaoPercentual =
        faturamentoAnterior > 0
          ? ((faturamentoAtual - faturamentoAnterior) / faturamentoAnterior) * 100
          : faturamentoAtual > 0
            ? 100
            : 0

      const totalPositivados = currentAgg.clientes_positivados
      const totalCarteira = clientes.filter((c) => c.status === 'ativo').length

      const byDist = aggregateSalesBy(currentSales, (r) => r.distribuidor_id)
      const rankingDistribuidores = Array.from(byDist.entries())
        .map(([distribuidor_id, agg]) => ({
          distribuidor_id,
          faturamento: agg.faturamento,
        }))
        .sort((a, b) => b.faturamento - a.faturamento)

      // "Ativos" aqui é o status do cliente na carteira: quantos da lista
      // estratégica continuam ativos comercialmente.
      const statusPorCliente = new Map(clientes.map((c) => [c.id as string, c.status as string]))
      const estrategicosAtivos = estrategicos.filter(
        (e) => statusPorCliente.get(e.cliente_id as string) === 'ativo'
      )

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
        clientes_estrategicos_ativos: estrategicosAtivos.length,
        clientes_estrategicos_total: estrategicos.length,
        metas_atingidas: metasAtingidas.length,
        total_metas: metas.length,
        itens_estoque_critico: estoqueCritico.length,
      }

      return {
        kpis,
        distribuidoresAtivos: distribuidores.length,
        rankingDistribuidores,
        periodoReferencia: anchorMonth,
        itensVendidos: currentAgg.itens_vendidos,
      }
    },
  })
}
