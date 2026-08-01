import type { ClienteDistribuidor } from '@/types/distribuidor'
import type { ClientTagCategory } from '@/components/distribuidor/ClientTag'
import type { ClienteFatResumo } from '@/lib/cliente-faturamento-resumo'
import { formatDate } from '@/lib/format'

/** Dias desde cadastro ou 1ª NF para considerar "cliente novo". */
export const CLIENTE_NOVO_DIAS = 90

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
  /** Reservado: cadastro estratégico / base de produtos (flag futura no banco). */
  clienteEstrategico?: boolean
}

function diasDesde(isoDate: string | null | undefined): number | null {
  if (!isoDate) return null
  const t = new Date(isoDate.includes('T') ? isoDate : `${isoDate}T12:00:00`).getTime()
  if (Number.isNaN(t)) return null
  return Math.floor((Date.now() - t) / 86_400_000)
}

export function isClienteNovo(
  cliente: ClienteDistribuidor,
  resumo?: ClienteFatResumo
): boolean {
  const criadoDias = diasDesde(cliente.criado_em)
  if (criadoDias != null && criadoDias <= CLIENTE_NOVO_DIAS) return true

  const primeiraNfDias = diasDesde(resumo?.primeiraCompra)
  if (primeiraNfDias != null && primeiraNfDias <= CLIENTE_NOVO_DIAS) return true

  return false
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

  if (isClienteNovo(cliente, resumo)) {
    tags.push({
      id: 'cliente_novo',
      label: opts?.compact ? 'Novo' : 'Cliente novo',
      category: 'fonte',
      title: 'Cadastro ou 1ª compra nos últimos 90 dias',
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

  if (cliente.plano_excelencia) {
    tags.push({
      id: 'excelencia',
      label: opts?.compact ? 'Excel.' : 'Excelência',
      category: 'programa',
      title: 'Participante do plano de excelência',
    })
  }

  if (clienteEstrategico) {
    tags.push({
      id: 'estrategico',
      label: opts?.compact ? 'Estrat.' : 'Estratégico',
      category: 'destaque',
      title: 'Cliente marcado na base estratégica de cadastro',
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
  'Cliente estratégico — flag manual na base de cadastro/produtos',
  'Mix completo — atingiu SKUs mínimos do programa',
  'Reativado — voltou a comprar após gap longo',
  'Alta recorrência — frequência acima da média da carteira',
  'Potencial Insights — sell-out histórico sem sell-in local',
] as const
