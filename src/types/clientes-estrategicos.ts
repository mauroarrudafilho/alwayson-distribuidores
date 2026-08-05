import type { ClienteDistribuidor } from '@/types/distribuidor'

/**
 * Origem da indicação. Lista fechada (espelha o CHECK da migration 052) porque
 * alimenta filtro — justificativa em texto livre vai em `motivo`/`observacao`.
 */
/**
 * ⚠️ Provedor externo de dado de mercado **não entra aqui** (migration 063):
 * a restrição contratual vale para o classificador, não só para o texto livre.
 * Uma lista vinda de relatório de terceiro entra como `potencial`.
 */
export const ORIGENS_ESTRATEGICAS = [
  { value: 'indicacao', label: 'Indicação' },
  { value: 'decisao_comercial', label: 'Decisão comercial' },
  { value: 'rede', label: 'Rede / grupo' },
  { value: 'potencial', label: 'Potencial de território' },
  { value: 'outro', label: 'Outro' },
] as const

export type OrigemEstrategica = (typeof ORIGENS_ESTRATEGICAS)[number]['value']

export const PRIORIDADES = [
  { value: 'alta', label: 'Alta' },
  { value: 'media', label: 'Média' },
  { value: 'baixa', label: 'Baixa' },
] as const

export type PrioridadeEstrategica = (typeof PRIORIDADES)[number]['value']

export const ORIGEM_LABELS: Record<OrigemEstrategica, string> = Object.fromEntries(
  ORIGENS_ESTRATEGICAS.map((o) => [o.value, o.label])
) as Record<OrigemEstrategica, string>

export const PRIORIDADE_LABELS: Record<PrioridadeEstrategica, string> = Object.fromEntries(
  PRIORIDADES.map((p) => [p.value, p.label])
) as Record<PrioridadeEstrategica, string>

/**
 * Uma linha da lista curada. Não é derivada de faturamento: alguém decidiu
 * incluir este cliente e escreveu por quê.
 */
export interface ClienteEstrategico {
  id: string
  /** Chave natural. Existe mesmo quando o CNPJ não é cliente de ninguém. */
  cnpj: string
  /** NULL = alvo territorial, sem parceiro dono (migration 062). */
  distribuidor_id: string | null
  /** NULL = ainda não está em nenhuma carteira. */
  cliente_id: string | null
  cidade: string | null
  estado: string | null
  motivo: string | null
  origem: OrigemEstrategica | null
  prioridade: PrioridadeEstrategica
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
 * territorial) — nunca armazenados a partir do relatório de origem.
 */
export type ClienteEstrategicoLinha = ClienteEstrategico & {
  nome_exibicao: string | null
  cidade_exibicao: string | null
  estado_exibicao: string | null
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
