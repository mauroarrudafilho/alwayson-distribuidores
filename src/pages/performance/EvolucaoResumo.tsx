import { DollarSign, FileText, Users, Receipt } from 'lucide-react'
import { KPICard } from '@/components/distribuidor/KPICard'
import { KPIGrid } from '@/components/distribuidor/KPIGrid'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/format'
import { calcularComparacao, calcularJanela } from '@/lib/janela-periodo'
import { resumirPeriodo, useFaturamentoMensal } from '@/hooks/useFaturamentoMensal'
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
  // Sem contraparte não há com o que comparar — a variação fica ausente, não zero.
  const b = comparacao ? resumirPeriodo(anterior) : undefined
  const legenda = LEGENDA_COMPARACAO[filters.comparar]

  return (
    <KPIGrid>
      <KPICard
        label="Faturamento"
        value={formatCurrency(a.faturamento)}
        icon={DollarSign}
        {...propsVariacao(a.faturamento, b?.faturamento, legenda)}
      />
      <KPICard
        label="Notas"
        value={a.nfs.toLocaleString('pt-BR')}
        icon={FileText}
        {...propsVariacao(a.nfs, b?.nfs, legenda)}
      />
      <KPICard
        label="Clientes por mês"
        value={a.clientes.toLocaleString('pt-BR')}
        icon={Users}
        {...propsVariacao(a.clientes, b?.clientes, legenda)}
      />
      <KPICard
        label="Ticket médio"
        value={formatCurrency(a.ticketMedio)}
        icon={Receipt}
        {...propsVariacao(a.ticketMedio, b?.ticketMedio, legenda)}
      />
    </KPIGrid>
  )
}
