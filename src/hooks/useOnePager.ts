import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { monthStart, monthEnd, prevMonth } from '@/lib/periodo'

/**
 * Dados do one-pager mensal do distribuidor (Pacote C.4) — o relatório que o
 * KAM leva para a reunião com o parceiro. Tudo lido das views agregadas; nada
 * de nota a nota no cliente.
 */

export interface OnePagerMeta {
  hierarquia: string
  valor_meta: number
  valor_realizado: number | null
  percentual_atingimento: number | null
}

export interface OnePagerProduto {
  sku: string
  nome: string
  atual: number
  anterior: number
  variacao: number | null
}

export interface OnePagerMes {
  mes: string
  faturamento: number
  clientes_positivados: number
}

export interface OnePagerRelatorio {
  tipo: string
  periodo_referencia: string | null
  status: string
  criado_em: string | null
}

export interface OnePagerDados {
  mes: string
  mesAnterior: string
  faturamentoMes: number
  faturamentoMesAnterior: number
  clientesPositivados: number
  skusDistintos: number
  metas: OnePagerMeta[]
  topProdutos: OnePagerProduto[]
  quedasProdutos: OnePagerProduto[]
  evolucaoMensal: OnePagerMes[]
  relatorios: OnePagerRelatorio[]
}

const MESES_EVOLUCAO = 12

function n(v: unknown): number {
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}

export function useOnePager(distribuidorId: string | undefined, mes: string) {
  return useQuery({
    queryKey: ['one-pager', distribuidorId, mes],
    enabled: !!distribuidorId && !!mes,
    queryFn: async (): Promise<OnePagerDados> => {
      const mesAnterior = prevMonth(mes)
      const primeiroMes = prevMonthFrom(mes, MESES_EVOLUCAO - 1)

      const [resumo, evolucao, metas, produtos, relatorios] = await Promise.all([
        // Faturamento do mês e do anterior (linha de total do distribuidor).
        supabase
          .from('alwayson_faturamento_v_mensal')
          .select('mes, faturamento, clientes_positivados, skus_distintos')
          .eq('distribuidor_id', distribuidorId!)
          .eq('eh_total_distribuidor', true)
          .in('mes', [`${mes}-01`, `${mesAnterior}-01`]),
        // Evolução dos últimos N meses.
        supabase
          .from('alwayson_faturamento_v_mensal')
          .select('mes, faturamento, clientes_positivados')
          .eq('distribuidor_id', distribuidorId!)
          .eq('eh_total_distribuidor', true)
          .gte('mes', `${primeiroMes}-01`)
          .lte('mes', `${mes}-01`)
          .order('mes'),
        // Metas do mês (view derivada — realizado nunca é coluna gravada).
        supabase
          .from('alwayson_metas_v_acompanhamento')
          .select('hierarquia, valor_meta, valor_realizado, percentual_atingimento')
          .eq('distribuidor_id', distribuidorId!)
          .eq('tipo', 'faturamento')
          .eq('periodo_inicio', monthStart(mes))
          .eq('periodo_fim', monthEnd(mes))
          .order('hierarquia'),
        // Produtos do mês e do anterior, para top e quedas.
        supabase
          .from('alwayson_faturamento_v_mensal_produto')
          .select('sku, nome_produto, mes, faturamento')
          .eq('distribuidor_id', distribuidorId!)
          .gte('mes', `${mesAnterior}-01`)
          .lte('mes', `${mes}-01`),
        // Últimos relatórios recebidos (saúde do dado).
        supabase
          .from('alwayson_relatorios_ingestao')
          .select('tipo, periodo_referencia, status, criado_em')
          .eq('distribuidor_id', distribuidorId!)
          .order('criado_em', { ascending: false })
          .limit(6),
      ])
      if (resumo.error) throw resumo.error
      if (evolucao.error) throw evolucao.error
      if (metas.error) throw metas.error
      if (produtos.error) throw produtos.error
      if (relatorios.error) throw relatorios.error

      const linhaDoMes = (rows: unknown[], alvo: string) => {
        const r = (rows ?? []).find((x) => (x as { mes: string }).mes === `${alvo}-01`) as
          | { faturamento?: unknown; clientes_positivados?: unknown; skus_distintos?: unknown }
          | undefined
        return r
      }

      const mesAtual = linhaDoMes(resumo.data, mes)
      const anterior = linhaDoMes(resumo.data, mesAnterior)

      // Agrega produtos (o grão da view é por vendedor) — atual × anterior.
      const porSku = new Map<string, { nome: string; atual: number; anterior: number }>()
      for (const r of produtos.data ?? []) {
        const row = r as { sku: string; nome_produto: string; mes: string; faturamento: unknown }
        const v = porSku.get(row.sku) ?? { nome: row.nome_produto, atual: 0, anterior: 0 }
        if (String(row.mes).slice(0, 7) === mes) v.atual += n(row.faturamento)
        else v.anterior += n(row.faturamento)
        porSku.set(row.sku, v)
      }

      const produtosList: OnePagerProduto[] = [...porSku.entries()].map(([sku, v]) => ({
        sku,
        nome: v.nome,
        atual: v.atual,
        anterior: v.anterior,
        variacao: v.anterior > 0 ? ((v.atual - v.anterior) / v.anterior) * 100 : null,
      }))

      const topProdutos = [...produtosList]
        .sort((a, b) => b.atual - a.atual)
        .slice(0, 10)

      const quedasProdutos = produtosList
        .filter((p) => p.variacao !== null && p.variacao < 0)
        .sort((a, b) => (a.variacao ?? 0) - (b.variacao ?? 0))
        .slice(0, 5)

      return {
        mes,
        mesAnterior,
        faturamentoMes: n(mesAtual?.faturamento),
        faturamentoMesAnterior: n(anterior?.faturamento),
        clientesPositivados: n(mesAtual?.clientes_positivados),
        skusDistintos: n(mesAtual?.skus_distintos),
        metas: (metas.data ?? []).map((m) => ({
          hierarquia: m.hierarquia as string,
          valor_meta: n(m.valor_meta),
          valor_realizado: m.valor_realizado == null ? null : n(m.valor_realizado),
          percentual_atingimento:
            m.percentual_atingimento == null ? null : n(m.percentual_atingimento),
        })),
        topProdutos,
        quedasProdutos,
        evolucaoMensal: (evolucao.data ?? []).map((r) => ({
          mes: String(r.mes).slice(0, 7),
          faturamento: n(r.faturamento),
          clientes_positivados: n(r.clientes_positivados),
        })),
        relatorios: (relatorios.data ?? []).map((r) => ({
          tipo: r.tipo as string,
          periodo_referencia: r.periodo_referencia as string | null,
          status: r.status as string,
          criado_em: r.criado_em as string | null,
        })),
      }
    },
  })
}

/** Mês corrente menos `monthsBack` meses (YYYY-MM). */
function prevMonthFrom(mes: string, monthsBack: number): string {
  const [ano, m] = mes.split('-').map(Number)
  const d = new Date(ano, m - 1 - monthsBack, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
