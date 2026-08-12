export interface Distribuidor {
  id: string
  nome: string
  cnpj: string
  estado: 'PE' | 'PB' | 'RN' | 'AL' | 'SE'
  cidade: string
  responsavel: string
  email?: string
  telefone?: string
  lead_time_dias?: number
  status: 'ativo' | 'inativo' | 'em_analise'
  criado_em: string
  atualizado_em: string
  /** Nº de PDVs que o parceiro declara atender (migration 046). Confrontar com a carteira cadastrada. */
  carteira_declarada?: number | null
  /** Frequência padrão do roteiro — define a régua da positivação. */
  frequencia_visita?: 'semanal' | 'quinzenal' | 'mensal' | 'outro' | null
  /** Início da parceria — permite comparar parceiros por safra. */
  inicio_parceria?: string | null
}

export interface Vendedor {
  id: string
  distribuidor_id: string
  /** Código no ERP do distribuidor; corresponde a `codigo_externo` no Supabase após migration 005. */
  codigo_externo?: string
  nome: string
  supervisor_id?: string
  tipo: 'vendedor' | 'supervisor' | 'gerente'
  ativo: boolean
  criado_em: string
}

export interface PerformancePeriodo {
  id: string
  distribuidor_id: string
  vendedor_id: string
  periodo_inicio: string
  periodo_fim: string
  faturamento: number
  clientes_positivados: number
  total_clientes_carteira: number
  itens_vendidos: number
  pedidos_realizados: number
  criado_em: string
}

export interface ClienteDistribuidor {
  id: string
  distribuidor_id: string
  cnpj: string
  razao_social: string
  nome_fantasia?: string
  cidade: string
  estado: string
  /** Endereço fiscal enriquecido via BrasilAPI (migration 006). */
  endereco_logradouro?: string
  endereco_numero?: string
  endereco_bairro?: string
  endereco_cep?: string
  /** Coordenadas WGS-84 geocodificadas via Nominatim/OSM (migration 006). */
  lat?: number
  lng?: number
  /** Timestamp do último enriquecimento geográfico; null = pendente. */
  geo_enriquecido_em?: string
  vendedor_id?: string
  /**
   * Vestigial: a coluna existe no banco mas nunca foi alimentada pela ingestão.
   * A curadoria vive em `alwayson_clientes_estrategicos` (migration 052) — não
   * volte a ler daqui.
   */
  plano_excelencia: boolean
  itens_cadastrados: number
  ultima_compra?: string
  frequencia_compra_dias?: number
  ticket_medio?: number
  status: 'ativo' | 'inativo' | 'em_risco'
  criado_em?: string
  atualizado_em?: string
}

/** Realizado por critério de acompanhamento (alwayson_clientes_estrategicos_criterios). */
export interface CriterioEstrategicoRealizado {
  id: string
  cliente_id: string
  criterio: 'mix_minimo' | 'recorrencia' | 'volume_minimo' | 'itens_cadastrados'
  meta: number
  realizado: number
  atingido: boolean
  periodo: string
}

export interface Meta {
  id: string
  distribuidor_id: string
  vendedor_id?: string
  hierarquia: 'vendedor' | 'supervisor' | 'gerente' | 'distribuidor'
  tipo: 'faturamento' | 'positivacao' | 'mix' | 'clientes_estrategicos'
  periodo_inicio: string
  periodo_fim: string
  valor_meta: number
  /**
   * Derivado do faturamento pela view `alwayson_metas_v_acompanhamento`
   * (migration 045) — não existe como coluna gravada. Null quando o tipo ainda
   * não é calculável (`clientes_estrategicos`, que depende da lista curada).
   */
  valor_realizado: number | null
  /** Null quando não há realizado calculável ou `valor_meta` é zero. */
  percentual_atingimento: number | null
}

export interface EstoqueItem {
  id: string
  distribuidor_id: string
  sku: string
  descricao: string
  quantidade_atual: number
  quantidade_minima: number
  estoque_minimo_calculado?: number
  dias_cobertura: number
  status: 'saudavel' | 'critico' | 'overstock'
  ultima_atualizacao: string
  sugestao_pedido?: number
}

export interface RelatorioIngestao {
  id: string
  distribuidor_id: string
  tipo: 'vendas' | 'estoque' | 'clientes'
  arquivo_nome: string
  status: 'pendente' | 'processando' | 'concluido' | 'erro'
  periodo_referencia: string
  registros_processados?: number
  erros?: string[]
  criado_em: string
}

/** Mapeamento código interno do distribuidor → SKU oficial (alwayson_produtos.sku). */
export interface DistribuidorProdutoDePara {
  id: string
  distribuidor_id: string
  codigo_cliente: string
  sku_fornecedor: string
  ativo: boolean
  criado_em: string
  atualizado_em: string
}

/** Código bruto do distribuidor faturado sem produto_id resolvido e sem entrada no de-para deste distribuidor. */
export interface DistribuidorProdutoNaoMapeado {
  sku: string
  descricao: string
  faturamento_total: number
  total_linhas: number
}

export interface DistribuidorKPIs {
  faturamento_periodo: number
  faturamento_periodo_anterior: number
  variacao_percentual: number
  clientes_positivados: number
  total_clientes_carteira: number
  taxa_positivacao: number
  /** Da lista curada (`alwayson_clientes_estrategicos`), não de flag no cadastro. */
  clientes_estrategicos_ativos: number
  clientes_estrategicos_total: number
  metas_atingidas: number
  total_metas: number
  itens_estoque_critico: number
}

export type EstadoNordeste = 'PE' | 'PB' | 'RN' | 'AL' | 'SE'

export const ESTADOS_NORDESTE: { value: EstadoNordeste; label: string }[] = [
  { value: 'PE', label: 'Pernambuco' },
  { value: 'PB', label: 'Paraíba' },
  { value: 'RN', label: 'Rio Grande do Norte' },
  { value: 'AL', label: 'Alagoas' },
  { value: 'SE', label: 'Sergipe' },
]
