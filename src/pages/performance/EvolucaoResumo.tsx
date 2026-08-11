import { DollarSign, FileText, Users, Receipt } from 'lucide-react'
import { KPICard } from '@/components/distribuidor/KPICard'
import { KPIGrid } from '@/components/distribuidor/KPIGrid'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/format'
import { calcularComparacao, calcularJanela, type Janela } from '@/lib/janela-periodo'
import {
  resumirPeriodo,
  useFaturamentoMensal,
  type ResumoPeriodo,
} from '@/hooks/useFaturamentoMensal'
import type { FaturamentoMensalRow } from '@/types/faturamento-mensal'
import { usePerformanceContext } from './PerformanceContext'

/**
 * Percentual de variação, ou null quando não há contraparte. Devolve número
 * cru porque o KPICard já formata sinal, casas e cor pela prop `trend`.
 */
function variacao(atual: number, anterior: number | undefined): number | null {
  if (anterior === undefined || anterior === 0) return null
  return ((atual - anterior) / anterior) * 100
}

/** Monta as props de variação do KPICard a partir do par (atual, anterior). */
function propsVariacao(atual: number, anterior: number | undefined, legenda: string) {
  const v = variacao(atual, anterior)
  if (v === null) return { subtitle: 'sem comparação' }
  return { trend: { value: v, positive: v >= 0 }, subtitle: legenda }
}

const LEGENDA_COMPARACAO: Record<string, string> = {
  ano_anterior: 'vs. ano anterior',
  periodo_anterior: 'vs. período anterior',
  nenhum: '',
}

interface ComparacaoLikeForLike {
  /** Base resumida só nos meses com contraparte — usar para a % de variação, nunca para o valor do card. */
  aLike?: ResumoPeriodo
  /** Contraparte — sempre igual a `resumirPeriodo(anterior)`, já que a query só devolve meses existentes. */
  b?: ResumoPeriodo
  mesesComparados: number
  totalMeses: number
}

/**
 * `resumirPeriodo` soma o período inteiro; comparar uma janela de 12 meses
 * contra uma contraparte de 7 (2025 só começa em janeiro) infla a variação
 * (FINDING 1). Aqui restringimos os dois lados aos meses que existem nas
 * DUAS pontas, por posição — `janela.meses[i]` corresponde a
 * `comparacao.meses[i]`, nunca por igualdade de string (são anos diferentes).
 *
 * O valor exibido no card continua somando a janela inteira; só a base da %
 * muda. Sem nenhum mês em comum, devolve tudo `undefined` — mesmo
 * comportamento de "sem comparação" de antes.
 */
function comparacaoLikeForLike(
  atual: FaturamentoMensalRow[],
  anterior: FaturamentoMensalRow[],
  janela: Janela,
  comparacao: Janela | null
): ComparacaoLikeForLike {
  const totalMeses = janela.meses.length
  if (!comparacao) return { mesesComparados: 0, totalMeses }

  const mesesAnteriorPresentes = new Set(anterior.map((r) => r.mes.slice(0, 7)))
  const mesesBaseComContraparte = new Set(
    comparacao.meses.reduce<string[]>((acc, mes, i) => {
      if (mesesAnteriorPresentes.has(mes)) acc.push(janela.meses[i])
      return acc
    }, [])
  )
  const mesesComparados = mesesBaseComContraparte.size
  if (mesesComparados === 0) return { mesesComparados, totalMeses }

  const atualLike = atual.filter((r) => mesesBaseComContraparte.has(r.mes.slice(0, 7)))
  return {
    aLike: resumirPeriodo(atualLike),
    b: resumirPeriodo(anterior),
    mesesComparados,
    totalMeses,
  }
}

export function EvolucaoResumo() {
  const { filters } = usePerformanceContext()
  const janela = calcularJanela(filters.janela)
  const comparacao = calcularComparacao(janela, filters.comparar)

  const { data: atual = [], isLoading: carregandoAtual } = useFaturamentoMensal(
    filters.distribuidorId,
    janela
  )
  // Chamada incondicional por regra de hooks. Sem comparação, a chave da query é
  // a mesma da base e o React Query devolve o cache — não é ida extra.
  const { data: anterior = [], isLoading: carregandoAnterior } = useFaturamentoMensal(
    filters.distribuidorId,
    comparacao ?? janela
  )

  // ⚠️ As DUAS têm de entrar no gate. Se só a primeira contasse, enquanto a
  // comparação ainda estivesse a chegar `anterior` seria [], `resumirPeriodo`
  // devolveria zeros, e o card mostraria "sem comparação" antes de saltar para a
  // variação real — um estado falso visível.
  const isLoading = carregandoAtual || carregandoAnterior

  if (isLoading) {
    return (
      <KPIGrid>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </KPIGrid>
    )
  }

  const a = resumirPeriodo(atual)
  // Variação sempre like-for-like: só os meses com contraparte real no banco
  // entram na %. `aLike`/`b` ficam `undefined` juntos — sem contraparte não há
  // com o que comparar, e a variação fica ausente, não zero (ver FINDING 1).
  const { aLike, b, mesesComparados, totalMeses } = comparacaoLikeForLike(
    atual,
    anterior,
    janela,
    comparacao
  )
  const legendaBase = LEGENDA_COMPARACAO[filters.comparar]
  const legenda =
    mesesComparados > 0 && mesesComparados < totalMeses
      ? `${legendaBase} (${mesesComparados} de ${totalMeses} meses)`
      : legendaBase

  return (
    <KPIGrid>
      <KPICard
        label="Faturamento"
        value={formatCurrency(a.faturamento)}
        icon={DollarSign}
        {...propsVariacao(aLike?.faturamento ?? a.faturamento, b?.faturamento, legenda)}
      />
      <KPICard
        label="Notas"
        value={a.nfs.toLocaleString('pt-BR')}
        icon={FileText}
        {...propsVariacao(aLike?.nfs ?? a.nfs, b?.nfs, legenda)}
      />
      <KPICard
        label="Clientes por mês"
        value={a.clientes.toLocaleString('pt-BR')}
        icon={Users}
        {...propsVariacao(aLike?.clientes ?? a.clientes, b?.clientes, legenda)}
      />
      <KPICard
        label="Ticket médio"
        value={formatCurrency(a.ticketMedio)}
        icon={Receipt}
        {...propsVariacao(aLike?.ticketMedio ?? a.ticketMedio, b?.ticketMedio, legenda)}
      />
    </KPIGrid>
  )
}
