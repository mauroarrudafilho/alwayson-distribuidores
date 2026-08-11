import { useMemo } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatCurrency } from '@/lib/format'
import { calcularComparacao, calcularJanela } from '@/lib/janela-periodo'
import { useFaturamentoMensal } from '@/hooks/useFaturamentoMensal'
import { useMetas } from '@/hooks/useMetas'
import {
  InsightsChartCard,
  CHART_AXIS_TICK,
  CHART_GRID_STROKE,
  INSIGHTS_CHART_COLORS,
  formatCurrencyCompact,
  coerceTooltipNumber,
} from '@/components/insights/charts'
import { usePerformanceContext } from './PerformanceContext'

const MES_CURTO = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez',
]

function rotuloMes(mesIso: string): string {
  const [ano, mes] = mesIso.split('-').map(Number)
  return `${MES_CURTO[mes - 1]}/${String(ano).slice(2)}`
}

export function EvolucaoGrafico() {
  const { filters } = usePerformanceContext()
  const janela = calcularJanela(filters.janela)
  const comparacao = calcularComparacao(janela, filters.comparar)

  const { data: atual = [] } = useFaturamentoMensal(filters.distribuidorId, janela)
  const { data: anterior = [] } = useFaturamentoMensal(
    filters.distribuidorId,
    comparacao ?? janela
  )
  const { data: metasTodas = [] } = useMetas()

  // `useMetas()` devolve todas as metas, de todos os tipos e distribuidores —
  // filtragem é sempre por conta de quem chama. Aqui o gráfico é R$ de
  // faturamento, então só entra tipo=faturamento e hierarquia=distribuidor
  // (nível de topo): somar os outros níveis juntos contaria a mesma meta
  // várias vezes, porque supervisor/gerente têm rollup a partir dos
  // vendedores (migration 045).
  const metaPorMes = useMemo(() => {
    const out = new Map<string, number>()
    for (const m of metasTodas) {
      if (m.tipo !== 'faturamento' || m.hierarquia !== 'distribuidor') continue
      if (filters.distribuidorId && m.distribuidor_id !== filters.distribuidorId) continue
      const mesChave = m.periodo_inicio.slice(0, 7)
      out.set(mesChave, (out.get(mesChave) ?? 0) + m.valor_meta)
    }
    return out
  }, [metasTodas, filters.distribuidorId])

  const dados = useMemo(() => {
    // Alinha por posição: o i-ésimo mês da janela contra o i-ésimo da
    // comparação. Alinhar por data não funciona — são períodos diferentes.
    //
    // O mês em curso não entra: `calcularJanela` fecha no último mês completo.
    // É por isso que o gráfico não precisa de marcação de "parcial" — não há
    // ponto parcial nele.
    return janela.meses.map((mes, i) => {
      const linhaAtual = atual.find((r) => r.mes.startsWith(mes))
      const linhaAnterior = comparacao
        ? anterior.find((r) => r.mes.startsWith(comparacao.meses[i] ?? ''))
        : undefined
      return {
        mes: rotuloMes(mes),
        atual: linhaAtual?.faturamento ?? 0,
        anterior: linhaAnterior?.faturamento ?? null,
        meta: metaPorMes.get(mes) ?? null,
      }
    })
  }, [janela, comparacao, atual, anterior, metaPorMes])

  const temMeta = dados.some((d) => d.meta !== null)

  return (
    <InsightsChartCard title="Faturamento mês a mês" height={280} className="mb-4">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={dados} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
          <CartesianGrid stroke={CHART_GRID_STROKE} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="mes" tick={CHART_AXIS_TICK} />
          <YAxis
            tick={CHART_AXIS_TICK}
            tickFormatter={(v: number) => formatCurrencyCompact(v)}
          />
          <Tooltip
            formatter={((value: unknown) => formatCurrency(coerceTooltipNumber(value))) as never}
            contentStyle={{
              borderRadius: 8,
              border: '1px solid var(--color-border)',
              fontSize: 12,
            }}
          />
          {comparacao || temMeta ? (
            <Legend
              iconType="circle"
              wrapperStyle={{ fontSize: 11, paddingTop: 4 }}
              formatter={(value) => (
                <span className="text-xs text-muted-foreground">{value}</span>
              )}
            />
          ) : null}
          {comparacao ? (
            <Line
              type="monotone"
              dataKey="anterior"
              name="Período anterior"
              stroke={INSIGHTS_CHART_COLORS[1]}
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={false}
              connectNulls={false}
            />
          ) : null}
          <Line
            type="monotone"
            dataKey="atual"
            name="Período atual"
            stroke={INSIGHTS_CHART_COLORS[0]}
            strokeWidth={2}
            dot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="meta"
            name="Meta"
            stroke={INSIGHTS_CHART_COLORS[2]}
            strokeWidth={1.5}
            strokeDasharray="2 3"
            dot={{ r: 3 }}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </InsightsChartCard>
  )
}
