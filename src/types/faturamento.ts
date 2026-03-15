export interface Faturamento {
  id: string
  distribuidor_id: string
  cliente_id: string
  vendedor_id: string
  numero_nf: string
  data_emissao: string
  valor_total: number
  criado_em: string
}

export interface FaturamentoItem {
  id: string
  faturamento_id: string
  produto_id?: string
  sku: string
  descricao: string
  quantidade: number
  valor_unitario: number
  valor_total: number
}
