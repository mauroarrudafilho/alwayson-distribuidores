import { useMemo, useState } from 'react'
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

/**
 * Tooltip customizado — o padrão do Recharts ignora o destaque (lista tudo do
 * mês, mesmo com uma entidade isolada) e empilha "Nome" e "Nome (anterior)"
 * como linhas soltas, sem parear valor com variação. Aqui: uma linha por
 * entidade, atual e anterior juntos, com a mesma variação % colorida que o
 * resto da tela já usa (ColunaEvolucao/KPICard).
 */
interface TooltipPayloadItem {
  dataKey?: string | number
  value?: number | string
  color?: string
  stroke?: string
}

interface GraficoTooltipProps {
  active?: boolean
  payload?: TooltipPayloadItem[]
  label?: string
  /** Quando definido, só essa entidade aparece — mesmo se o mês tiver dado de outras. */
  destacada: string | null
  linhas: EntidadeNome[]
  comComparacao: boolean
}

function GraficoTooltip({
  active,
  payload,
  label,
  destacada,
  linhas,
  comComparacao,
}: GraficoTooltipProps) {
  if (!active || !payload?.length) return null

  const porEntidade = new Map<
    string,
    { atual?: number; anterior?: number | null; cor?: string }
  >()
  for (const item of payload) {
    const chave = typeof item.dataKey === 'string' ? item.dataKey : ''
    const ehAnterior = chave.endsWith('::anterior')
    const id = ehAnterior ? chave.slice(0, -'::anterior'.length) : chave
    const entrada = porEntidade.get(id) ?? {}
    const valor = typeof item.value === 'number' ? item.value : undefined
    if (ehAnterior) entrada.anterior = valor ?? null
    else {
      entrada.atual = valor
      entrada.cor = entrada.cor ?? item.color ?? item.stroke
    }
    porEntidade.set(id, entrada)
  }

  const idsParaMostrar = destacada ? [destacada] : linhas.map((l) => l.id)

  return (
    <div className="min-w-[11rem] rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1.5 font-medium text-foreground">{label}</p>
      <div className="space-y-1.5">
        {idsParaMostrar.map((id) => {
          const nome = linhas.find((l) => l.id === id)?.nome ?? id
          const valores = porEntidade.get(id)
          if (!valores || valores.atual === undefined) return null
          const variacao =
            comComparacao && typeof valores.anterior === 'number' && valores.anterior !== 0
              ? ((valores.atual - valores.anterior) / valores.anterior) * 100
              : null

          return (
            <div key={id} className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                {valores.cor && (
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: valores.cor }}
                  />
                )}
                <span className="truncate">{nome}</span>
              </span>
              <span className="flex shrink-0 items-baseline gap-1.5 tabular-nums">
                <span className="font-medium text-foreground">
                  {formatCurrency(valores.atual)}
                </span>
                {comComparacao &&
                  (variacao === null ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <span
                      className={cn(
                        'text-[11px] font-semibold',
                        variacao >= 0 ? 'text-success' : 'text-destructive'
                      )}
                    >
                      {variacao >= 0 ? '+' : ''}
                      {variacao.toFixed(1)}%
                    </span>
                  ))}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
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

  const [destacada, setDestacada] = useState<string | null>(null)

  if (top.length === 0) return null

  const linhas: EntidadeNome[] = temOutros ? [...top, { id: OUTROS_ID, nome: 'Outros' }] : top
  const clicavel = (id: string) => id !== OUTROS_ID
  // Opacidade da linha: 1 se nada está destacado ou é a entidade destacada; senão recua
  // para deixar as outras em evidência. "Outros" participa do destaque — só não navega.
  const opacidade = (id: string) => (destacada === null || destacada === id ? 1 : 0.15)

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
            content={(props) => (
              <GraficoTooltip
                {...(props as unknown as Omit<
                  GraficoTooltipProps,
                  'destacada' | 'linhas' | 'comComparacao'
                >)}
                destacada={destacada}
                linhas={linhas}
                comComparacao={!!comparacao}
              />
            )}
          />
          <Legend
            iconType="circle"
            wrapperStyle={{ fontSize: 11, paddingTop: 4 }}
            onClick={(entry) => {
              // Legenda destaca, não navega — clicar na linha do gráfico é que leva à
              // próxima aba. Com várias entidades sobrepostas, isolar uma de cada vez
              // é o que torna o gráfico legível; navegar ali fecharia a comparação.
              const id = typeof entry.dataKey === 'string' ? entry.dataKey : ''
              setDestacada((atual) => (atual === id ? null : id))
            }}
            formatter={(value: string, entry: { dataKey?: unknown }) => {
              const id = typeof entry.dataKey === 'string' ? entry.dataKey : ''
              return (
                <span
                  className={cn(
                    'cursor-pointer text-xs hover:text-foreground',
                    destacada === id ? 'font-semibold text-foreground' : 'text-muted-foreground'
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
                strokeOpacity={opacidade(entidade.id)}
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
                  strokeOpacity={opacidade(entidade.id)}
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
