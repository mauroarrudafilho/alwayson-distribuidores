export interface Produto {
  id: string
  sku: string
  descricao: string
  categoria?: string
  preco_referencia?: number
  ativo: boolean
  criado_em: string
}
