// Módulo Insights — sell-out territorial.
// Dados carregados pelo time Arruda (admin, carga única).
// Mesmo template de vendas dos distribuidores → comparativo maçã com maçã.

export interface InsightsUpload {
  id: string
  nome: string
  periodo_inicio: string
  periodo_fim: string
  arquivo_nome: string
  status: 'processando' | 'concluido' | 'erro'
  total_nfs?: number
  total_itens?: number
  erros?: unknown
  criado_por?: string
  criado_em: string
}

export interface InsightsNf {
  id: string
  upload_id: string
  numero_nf: string
  data_emissao: string
  cnpj_cliente: string
  nome_cliente?: string
  /** Cidade enriquecida via BrasilAPI; null = pendente. */
  cidade?: string
  estado?: string
  lat?: number
  lng?: number
  geo_enriquecido_em?: string
  codigo_vendedor?: string
  nome_vendedor?: string
  codigo_supervisor?: string
  nome_supervisor?: string
  codigo_gerente?: string
  nome_gerente?: string
  /** Soma de InsightsNfItem.valor_total. */
  valor_total: number
  criado_em: string
}

export interface InsightsNfItem {
  id: string
  nf_id: string
  sku: string
  descricao?: string
  quantidade: number
  unidade?: string
  valor_unitario?: number
  valor_total: number
}

// ─── Analytics shapes (resultados de queries agregadas) ───────────────────

/** Visão por cidade — usada na rota /insights com filtro de cidade. */
export interface InsightsCidadeRow {
  cidade: string
  estado: string
  faturamento_total: number
  total_nfs: number
  total_clientes: number
  ticket_medio_cliente: number
  total_skus: number
  /** Itens agregados na unidade predominante (volume). */
  quantidade_total: number
  unidade_predominante?: string
}

/** Top cliente dentro de uma cidade ou geral. */
export interface InsightsTopCliente {
  cnpj_cliente: string
  nome_cliente?: string
  cidade?: string
  estado?: string
  faturamento_total: number
  total_nfs: number
  ultima_compra: string
  total_skus: number
}

/** Histórico mensal de um cliente — evolução ao longo do tempo. */
export interface InsightsClienteMes {
  ano_mes: string           // "2026-03"
  faturamento: number
  total_nfs: number
  total_skus: number
  quantidade_total: number
}

/** Mix de um cliente — SKUs e volumes ao longo do tempo. */
export interface InsightsClienteMixRow {
  sku: string
  descricao?: string
  /** Meses em que o SKU apareceu. */
  meses_ativos: number
  quantidade_total: number
  unidade?: string
  faturamento_total: number
  primeira_compra: string
  ultima_compra: string
}
