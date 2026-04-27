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
  plano_excelencia: boolean
  itens_cadastrados: number
  ultima_compra?: string
  frequencia_compra_dias?: number
  ticket_medio?: number
  status: 'ativo' | 'inativo' | 'em_risco'
}

export interface ExcelenciaCriterio {
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
  tipo: 'faturamento' | 'positivacao' | 'mix' | 'clientes_excelencia'
  periodo_inicio: string
  periodo_fim: string
  valor_meta: number
  valor_realizado: number
  percentual_atingimento: number
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

export interface DistribuidorKPIs {
  faturamento_periodo: number
  faturamento_periodo_anterior: number
  variacao_percentual: number
  clientes_positivados: number
  total_clientes_carteira: number
  taxa_positivacao: number
  clientes_excelencia_ativos: number
  clientes_excelencia_total: number
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
