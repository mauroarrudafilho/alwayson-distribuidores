export interface Produto {
  id: string
  sku: string
  descricao: string
  categoria?: string
  /** Marca comercial (cadastro Vinícola Campestre). */
  marca?: string
  /** Detalhe da categoria (ex.: TINTO SUAVE). */
  detalhamento_categoria?: string
  ativo: boolean
  criado_em: string
}
