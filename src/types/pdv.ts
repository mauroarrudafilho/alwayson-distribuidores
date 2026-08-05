export type PdvSegmento =
  | 'subexplorado'
  | 'maduro'
  | 'revisar_cadastro'
  | 'reduzir'
  | 'nao_atendido'

export type PdvNivelGeocodificacao =
  | 'numero_exato'
  | 'logradouro'
  | 'cep'
  | 'setor_censitario'
  | 'nulo'

export interface PdvPrioridadeRow {
  id: string
  cnpj: string
  segmento: PdvSegmento
  potencial_estimado_mensal: number | null
  compra_media_mensal: number | null
  gap_reais: number | null
  percentual_do_potencial: number | null
  vendedor_id: string | null
  cliente_id: string | null
  nome_exibicao: string
  bairro: string | null
  cnae_principal: string | null
  vendedor_nome: string | null
  /** false = oportunidade de conquista na praça. */
  atendido: boolean
  faixa: string | null
  segmento_cnae: string | null
  /** CNPJ está na lista curada de Clientes Estratégicos (migration 065). */
  estrategico: boolean
  /** Curva ABC da lista estratégica, quando aplicável. */
  estrategico_prioridade: 'alta' | 'media' | 'baixa' | null
}

export interface PdvCoberturaRow {
  id: string
  uf: string
  municipio: string
  bairro: string
  cnae_grupo: string
  qtd_qualificados: number
  qtd_atendidos: number
  percentual_cobertura: number | null
  potencial_nao_atendido: number | null
}

export interface PdvCoberturaDetalheRow {
  cnpj: string
  nome: string
  segmento_cnae: string
  cnae_principal: string | null
  indice_relevancia: number
  faixa: string | null
  atendido: boolean
  cliente_id: string | null
  latitude: number | null
  longitude: number | null
  nivel_geocodificacao: PdvNivelGeocodificacao | null
  /** true quando há lat/lng plotável no mapa do drawer. */
  geo_mapa: boolean
}

export interface PdvMapaPonto {
  cnpj: string
  latitude: number
  longitude: number
  nome: string
  /** Índice 0–100 (consolidacao_v1) — tamanho da bolha no mapa. */
  indice_relevancia: number
  atendido: boolean
  nivel_geocodificacao: PdvNivelGeocodificacao | null
  bairro: string | null
  qtd_lojas_rede?: number | null
  cnae_principal: string | null
  /** Rótulo do segmento CNAE (ex.: Bar, Supermercado). */
  segmento_cnae?: string | null
  faixa?: string | null
  /** Quando na carteira — link para ficha do cliente. */
  cliente_id?: string | null
}

export interface PdvResumo {
  qualificados: number
  atendidos: number
  coberturaPct: number | null
  /** Soma dos índices de relevância (0–100) dos não atendidos. */
  relevanciaNaoAtendida: number
  subexplorados: number
  /** PDVs fora da carteira com faixa A ou B na praça. */
  oportunidadesAb: number
}
