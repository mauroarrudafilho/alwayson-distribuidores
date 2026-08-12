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
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/format'
import { PRIMEIRO_MES_SERIE, type Janela } from '@/lib/janela-periodo'
import type { SerieEntidade } from '@/hooks/useSerieEntidade'
import {
  InsightsChartCard,
  CHART_AXIS_TICK,
  CHART_GRID_STROKE,
  INSIGHTS_CHART_COLORS,
  formatCurrencyCompact,
  coerceTooltipNumber,
} from '@/components/insights/charts'

const MES_CURTO = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez',
]

function rotuloMes(mesIso: string): string {
  const [ano, mes] = mesIso.split('-').map(Number)
  return `${MES_CURTO[mes - 1]}/${String(ano).slice(2)}`
}

const TOP_N = 5
const OUTROS_ID = '__outros__'

interface EntidadeNome {
  id: string
  nome: string
}

interface Props {
  janela: Janela
  comparacao: Janela | null
  /** Todas as entidades do nível — a mesma lista já pré-filtrada por
   * hierarquia que a tabela do tab usa (ex.: `filteredSupervisores`). */
  entidades: EntidadeNome[]
  series: Map<string, SerieEntidade> | undefined
  seriesAnterior: Map<string, SerieEntidade> | undefined
  /** Mesmo handler que o clique da linha da tabela já usa. Nunca chamado
   * para "Outros" — não há entidade única para navegar. */
  onEntidadeClick: (id: string) => void
}

export function EvolucaoGraficoNivel({
  janela,
  comparacao,
  entidades,
  series,
  seriesAnterior,
  onEntidadeClick,
}: Props) {
  const { top, temOutros } = useMemo(() => {
    const ranked = [...entidades].sort(
      (a, b) => (series?.get(b.id)?.total ?? 0) - (series?.get(a.id)?.total ?? 0)
    )
    return { top: ranked.slice(0, TOP_N), temOutros: ranked.length > TOP_N }
  }, [entidades, series])

  const outrosIds = useMemo(() => {
    if (!temOutros) return []
    const topIds = new Set(top.map((e) => e.id))
    return entidades.filter((e) => !topIds.has(e.id)).map((e) => e.id)
  }, [entidades, top, temOutros])

  // Meses do intervalo de comparação anteriores ao início real da série: ali
  // não há linha nenhuma, mesmo que SerieEntidade preencha com 0 — 0 ali
  // significaria "vendeu zero", que é diferente de "não existe dado". A
  // máscara é explícita porque connectNulls só interrompe em cima de null.
  const semDadoAnterior = useMemo(() => {
    if (!comparacao) return []
    return comparacao.meses.map((mes) => mes < PRIMEIRO_MES_SERIE)
  }, [comparacao])

  const dados = useMemo(() => {
    return janela.meses.map((mes, i) => {
      const ponto: Record<string, string | number | null> = { mes: rotuloMes(mes) }

      for (const entidade of top) {
        ponto[entidade.id] = series?.get(entidade.id)?.valores[i] ?? 0
        if (comparacao) {
          ponto[`${entidade.id}::anterior`] = semDadoAnterior[i]
            ? null
            : (seriesAnterior?.get(entidade.id)?.valores[i] ?? 0)
        }
      }

      if (temOutros) {
        ponto[OUTROS_ID] = outrosIds.reduce(
          (soma, id) => soma + (series?.get(id)?.valores[i] ?? 0),
          0
        )
        if (comparacao) {
          ponto[`${OUTROS_ID}::anterior`] = semDadoAnterior[i]
            ? null
            : outrosIds.reduce(
                (soma, id) => soma + (seriesAnterior?.get(id)?.valores[i] ?? 0),
                0
              )
        }
      }

      return ponto
    })
  }, [janela, comparacao, top, outrosIds, temOutros, series, seriesAnterior, semDadoAnterior])

  if (top.length === 0) return null

  const linhas: EntidadeNome[] = temOutros ? [...top, { id: OUTROS_ID, nome: 'Outros' }] : top
  const clicavel = (id: string) => id !== OUTROS_ID

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
          <Legend
            iconType="circle"
            wrapperStyle={{ fontSize: 11, paddingTop: 4 }}
            onClick={(entry) => {
              const id = typeof entry.dataKey === 'string' ? entry.dataKey : ''
              if (clicavel(id)) onEntidadeClick(id)
            }}
            formatter={(value: string, entry: { dataKey?: unknown }) => {
              const id = typeof entry.dataKey === 'string' ? entry.dataKey : ''
              return (
                <span
                  className={cn(
                    'text-xs text-muted-foreground',
                    clicavel(id) && 'cursor-pointer hover:text-foreground'
                  )}
                >
                  {value}
                </span>
              )
            }}
          />
          {linhas.map((entidade, i) => {
            const cor = INSIGHTS_CHART_COLORS[i % INSIGHTS_CHART_COLORS.length]
            return (
              <Line
                key={entidade.id}
                type="monotone"
                dataKey={entidade.id}
                name={entidade.nome}
                stroke={cor}
                strokeWidth={2}
                dot={{ r: 3 }}
                onClick={() => clicavel(entidade.id) && onEntidadeClick(entidade.id)}
                style={clicavel(entidade.id) ? { cursor: 'pointer' } : undefined}
              />
            )
          })}
          {comparacao &&
            linhas.map((entidade, i) => {
              const cor = INSIGHTS_CHART_COLORS[i % INSIGHTS_CHART_COLORS.length]
              return (
                <Line
                  key={`${entidade.id}::anterior`}
                  type="monotone"
                  dataKey={`${entidade.id}::anterior`}
                  name={`${entidade.nome} (anterior)`}
                  legendType="none"
                  stroke={cor}
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={false}
                  connectNulls={false}
                />
              )
            })}
        </LineChart>
      </ResponsiveContainer>
    </InsightsChartCard>
  )
}
