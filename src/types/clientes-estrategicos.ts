import type { ClienteDistribuidor } from '@/types/distribuidor'

/**
 * Prioridade = **curva ABC por UF** (migration 064).
 *
 * Não é opinião de quem cadastrou: vem do tamanho relativo do PDV dentro do
 * próprio estado — A até 50% do volume da UF, B até 80%, C o resto. Calculada
 * na carga; o volume que a originou **não** é armazenado.
 */
export const PRIORIDADES = [
  { value: 'alta', label: 'Alta', classe: 'A' },
  { value: 'media', label: 'Média', classe: 'B' },
  { value: 'baixa', label: 'Baixa', classe: 'C' },
] as const

export type PrioridadeEstrategica = (typeof PRIORIDADES)[number]['value']

export const PRIORIDADE_LABELS: Record<PrioridadeEstrategica, string> = Object.fromEntries(
  PRIORIDADES.map((p) => [p.value, p.label])
) as Record<PrioridadeEstrategica, string>

/** Rótulo da classe ABC — usado onde a régua precisa ficar explícita. */
export const PRIORIDADE_CLASSE: Record<PrioridadeEstrategica, string> = Object.fromEntries(
  PRIORIDADES.map((p) => [p.value, p.classe])
) as Record<PrioridadeEstrategica, string>

/**
 * Uma linha da lista curada. A chave é o CNPJ: o alvo pode não ser cliente de
 * ninguém ainda.
 */
export interface ClienteEstrategico {
  id: string
  lat: number | null
  lng: number | null
  geo_fonte: string | null
  geo_atualizado_em: string | null
  /** Chave natural. Existe mesmo quando o CNPJ não é cliente de ninguém. */
  cnpj: string
  /** NULL = alvo territorial, sem parceiro dono (migration 062). */
  distribuidor_id: string | null
  /** NULL = ainda não está em nenhuma carteira. */
  cliente_id: string | null
  cidade: string | null
  estado: string | null
  prioridade: PrioridadeEstrategica
  /** Único campo de texto — `motivo` e `origem` saíram na migration 064. */
  observacao: string | null
  ativo: boolean
  adicionado_por: string | null
  adicionado_em: string
  atualizado_em: string
  removido_em: string | null
}

export type ClienteEstrategicoComCliente = ClienteEstrategico & {
  cliente: ClienteDistribuidor | null
}

/**
 * Linha da view `alwayson_clientes_estrategicos_v_lista`.
 *
 * Nome e praça são **resolvidos na leitura** a partir de fonte pública
 * (carteira do parceiro, Receita Federal via universo PDV, histórico
 * territorial) — nunca armazenados a partir do relatório que originou a lista.
 */
export type ClienteEstrategicoLinha = ClienteEstrategico & {
  nome_exibicao: string | null
  cidade_exibicao: string | null
  estado_exibicao: string | null
  lat_exibicao: number | null
  lng_exibicao: number | null
  /**
   * De onde veio a coordenada. `cidade_centroide` é aproximação pela cidade,
   * não o ponto do PDV — não serve para roteirização.
   */
  geo_fonte_exibicao: string | null
  na_carteira: boolean
  no_universo_pdv: boolean
}

/** Critérios de acompanhamento — o "como monitorar" da lista. */
export interface CriterioEstrategicoConfig {
  id: string
  distribuidor_id: string
  criterio_nome: string
  meta_valor: number
  tipo_comparacao: 'min' | 'max'
  ativo: boolean
  ordem: number
  criado_em: string
}
