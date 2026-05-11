import type {
  InsightsCidadeRow,
  InsightsProdutoRow,
  InsightsTopCliente,
} from '@/types/insights'

/**
 * Meses entre duas datas YYYY-MM-DD (early < late). Negativo ou inválido → 0.
 */
function monthsBetween(
  early: string | undefined | null,
  late: string | undefined | null
): number {
  if (!early || !late) return 0
  const a = new Date(`${early}T00:00:00`)
  const b = new Date(`${late}T00:00:00`)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0
  const diff = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())
  return Math.max(0, diff)
}

/**
 * Gap em meses entre a última compra do cliente e o fim do período Arruda.
 * Maior = cliente parou de comprar mais cedo dentro do histórico fechado.
 */
export function clienteGapMeses(
  cliente: InsightsTopCliente,
  periodoFim: string
): number {
  return monthsBetween(cliente.ultima_compra, periodoFim)
}

/**
 * Score de prioridade de cliente para ação de recuperação.
 *
 * Como os dados Arruda são uma fotografia fechada de 2022–2024, o gap até hoje
 * é o mesmo para todo mundo (e portanto inútil). O que diferencia: clientes de
 * alto faturamento que pararam de comprar ANTES do fim do período. Eles são
 * candidatos prioritários para recuperação via distribuidor atual.
 *
 * score = faturamento_total × (1 + 0.04 × meses_de_gap_no_periodo)
 */
export function clientePriorityScore(
  cliente: InsightsTopCliente,
  periodoFim: string
): number {
  const gap = clienteGapMeses(cliente, periodoFim)
  return cliente.faturamento_total * (1 + 0.04 * gap)
}

export interface PriorityCliente extends InsightsTopCliente {
  __score: number
  __gapMeses: number
}

export function topClientesPrioritarios(
  clientes: InsightsTopCliente[],
  periodoFim: string,
  limit = 10
): PriorityCliente[] {
  return clientes
    .map((c) => ({
      ...c,
      __score: clientePriorityScore(c, periodoFim),
      __gapMeses: clienteGapMeses(c, periodoFim),
    }))
    .sort((a, b) => b.__score - a.__score)
    .slice(0, limit)
}

/**
 * Score de cidade: faturamento × log(clientes + 1).
 * Premia volume + penetração (cidade não é só grande, tem muitos compradores distintos).
 */
export function cidadePriorityScore(c: InsightsCidadeRow): number {
  return c.faturamento_total * Math.log(c.total_clientes + 1)
}

export function topCidadesPrioritarias(
  cidades: InsightsCidadeRow[],
  limit = 10
): InsightsCidadeRow[] {
  return [...cidades]
    .sort((a, b) => cidadePriorityScore(b) - cidadePriorityScore(a))
    .slice(0, limit)
}

/**
 * Score de produto: faturamento × log(clientes + 1).
 * Premia SKUs com boa receita E adoção ampla (estratégicos, não nicho).
 */
export function produtoPriorityScore(p: InsightsProdutoRow): number {
  return p.faturamento_total * Math.log(p.total_clientes + 1)
}

export function topProdutosPrioritarios(
  produtos: InsightsProdutoRow[],
  limit = 10
): InsightsProdutoRow[] {
  return [...produtos]
    .sort((a, b) => produtoPriorityScore(b) - produtoPriorityScore(a))
    .slice(0, limit)
}
