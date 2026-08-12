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

/** De-para de SKU órfão do faturamento → SKU oficial em alwayson_produtos. */
export interface FaturamentoProdutoDePara {
  id: string
  sku_origem: string
  sku_fornecedor: string
  criado_por: string | null
  criado_em: string
}

/** SKU faturado sem produto_id resolvido e sem alias no de-para — fila de curadoria. */
export interface FaturamentoProdutoNaoMapeado {
  sku: string
  descricao: string
  faturamento_total: number
  total_linhas: number
}
