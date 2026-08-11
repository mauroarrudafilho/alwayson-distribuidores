/** Uma linha de `alwayson_faturamento_v_mensal` (migration 067). */
export interface FaturamentoMensalRow {
  distribuidor_id: string
  fornecedor_tenant_id: string | null
  /** NULL na linha de total do distribuidor. */
  vendedor_id: string | null
  /** true = linha de total; false = linha de um vendedor. */
  eh_total_distribuidor: boolean
  /** Primeiro dia do mês, YYYY-MM-DD. */
  mes: string
  faturamento: number
  nfs: number
  clientes_positivados: number
  skus_distintos: number
}
