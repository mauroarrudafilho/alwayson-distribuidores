import type { ClienteDistribuidor } from '@/types/distribuidor'
import type { ClientTagCategory } from '@/components/distribuidor/ClientTag'
import type { ClienteFatResumo } from '@/lib/cliente-faturamento-resumo'
import { formatDate } from '@/lib/format'

/** Gap mínimo (dias) entre duas compras consecutivas para sinalizar. */
export const SEM_COMPRA_DIAS_LIMIAR = 60

export type ClienteSinalizador = {
  id: string
  label: string
  category: ClientTagCategory
  title?: string
}

export interface ClienteSinalizadorInput {
  cliente: ClienteDistribuidor
  resumo?: ClienteFatResumo
  isTopComprador?: boolean
  /** Está na lista curada `alwayson_clientes_estrategicos` (migration 052). */
  clienteEstrategico?: boolean
}

/**
 * "Novo" = a primeira compra do cliente é a única que ele tem — vira "não
 * mais novo" assim que compra pela segunda vez, não importa há quanto tempo
 * a primeira foi.
 *
 * Não usar `cliente.criado_em`: numa carga histórica em massa, toda linha de
 * `alwayson_clientes_distribuidor` nasce com cadastro recente, mesmo quem tem
 * anos de compra — isso marcaria a carteira inteira como "nova" de uma vez.
 */
export function isClienteNovo(resumo?: ClienteFatResumo): boolean {
  return resumo?.nfsTotal === 1
}

export type ClassificacaoFiltro = 'novo' | 'top' | 'em_risco' | 'sem_compra'

export const CLASSIFICACAO_FILTRO_LABELS: Record<ClassificacaoFiltro, string> = {
  novo: 'Novo',
  top: 'Top comprador',
  em_risco: 'Em risco',
  sem_compra: `Sem compra ${SEM_COMPRA_DIAS_LIMIAR}d+`,
}

/**
 * Mesma condição que decide se o badge aparece na linha — o filtro de
 * Classificação usa esta função, não uma cópia. Se um dia a regra do badge
 * mudar, o filtro muda junto, de graça.
 */
export function clienteTemClassificacao(
  filtro: ClassificacaoFiltro,
  cliente: ClienteDistribuidor,
  resumo: ClienteFatResumo | undefined,
  isTopComprador: boolean
): boolean {
  switch (filtro) {
    case 'novo':
      return isClienteNovo(resumo)
    case 'top':
      return isTopComprador
    case 'em_risco':
      return cliente.status === 'em_risco'
    case 'sem_compra':
      return (
        (resumo?.diasSemCompra ?? 0) > SEM_COMPRA_DIAS_LIMIAR &&
        cliente.status !== 'inativo'
      )
  }
}

export function buildClienteSinalizadores(
  input: ClienteSinalizadorInput,
  opts?: { maxTags?: number; compact?: boolean }
): ClienteSinalizador[] {
  const { cliente, resumo, isTopComprador, clienteEstrategico } = input
  const tags: ClienteSinalizador[] = []

  if (isTopComprador) {
    tags.push({
      id: 'top_comprador',
      label: opts?.compact ? 'Top' : 'Top comprador',
      category: 'destaque',
      title: 'Entre os maiores faturamentos do recorte atual',
    })
  }

  if (isClienteNovo(resumo)) {
    tags.push({
      id: 'cliente_novo',
      label: opts?.compact ? 'Novo' : 'Cliente novo',
      category: 'fonte',
      title: 'Só tem uma compra registrada — some assim que comprar de novo',
    })
  }

  if (cliente.status === 'em_risco') {
    tags.push({
      id: 'em_risco',
      label: opts?.compact ? 'Risco' : 'Em risco',
      category: 'risk',
      title: 'Status comercial em risco',
    })
  }

  if (clienteEstrategico) {
    tags.push({
      id: 'estrategico',
      label: opts?.compact ? 'Estrat.' : 'Estratégico',
      category: 'programa',
      title: 'Está na lista curada de clientes estratégicos',
    })
  }

  const diasSemCompra = resumo?.diasSemCompra
  if (
    diasSemCompra != null &&
    diasSemCompra > SEM_COMPRA_DIAS_LIMIAR &&
    cliente.status !== 'inativo'
  ) {
    const { compraNoPeriodo, compraAnterior } = resumo ?? {}
    const title =
      compraNoPeriodo && compraAnterior
        ? `Compra em ${formatDate(compraNoPeriodo)} — ${diasSemCompra} dias desde a compra anterior (${formatDate(compraAnterior)})`
        : compraAnterior
          ? `Sem compra no período — ${diasSemCompra} dias desde a última NF (${formatDate(compraAnterior)})`
          : `${diasSemCompra} dias sem compra`

    tags.push({
      id: 'sem_compra',
      label: opts?.compact ? `${diasSemCompra}d` : `${diasSemCompra}d sem compra`,
      category: 'flag',
      title,
    })
  }

  const max = opts?.maxTags ?? tags.length
  return tags.slice(0, max)
}

/** Sugestões de sinalizadores para evoluir (documentação de produto). */
export const SINALIZADORES_FUTUROS = [
  'Mix completo — atingiu SKUs mínimos do programa',
  'Reativado — voltou a comprar após gap longo',
  'Alta recorrência — frequência acima da média da carteira',
  'Potencial Insights — sell-out histórico sem sell-in local',
] as const
