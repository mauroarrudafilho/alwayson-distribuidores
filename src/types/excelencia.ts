export interface ExcelenciaConfig {
  id: string
  distribuidor_id: string
  criterio_nome: string
  meta_valor: number
  tipo_comparacao: 'min' | 'max'
  ativo: boolean
  ordem: number
  criado_em: string
}

export interface ExcelenciaCliente {
  id: string
  distribuidor_id: string
  cliente_id: string
  ativo: boolean
  adicionado_em: string
}

export interface ExcelenciaMonitorRow {
  cliente_id: string
  cliente_nome: string
  cnpj: string
  criterios: {
    criterio_nome: string
    meta: number
    realizado: number
    status: 'verde' | 'amarelo' | 'vermelho'
  }[]
  score: number
}
