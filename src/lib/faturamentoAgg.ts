/** Agregações de sell-out a partir de NFs ingeridas. */

export type FaturamentoSaleRow = {
  id: string
  distribuidor_id: string
  vendedor_id: string
  cliente_id: string
  numero_nf: string
  data_emissao: string
  valor_total: number
  skus: string[]
}

export type FaturamentoAgg = {
  faturamento: number
  clientes_positivados: number
  itens_vendidos: number
  pedidos_realizados: number
}

export function aggregateSales(rows: FaturamentoSaleRow[]): FaturamentoAgg {
  const clientes = new Set<string>()
  const skus = new Set<string>()
  const nfs = new Set<string>()
  let faturamento = 0
  for (const r of rows) {
    clientes.add(r.cliente_id)
    nfs.add(r.numero_nf)
    faturamento += r.valor_total
    for (const s of r.skus) skus.add(s)
  }
  return {
    faturamento,
    clientes_positivados: clientes.size,
    itens_vendidos: skus.size,
    pedidos_realizados: nfs.size,
  }
}

/** Agrega por chave (ex.: vendedor_id ou distribuidor_id). */
export function aggregateSalesBy(
  rows: FaturamentoSaleRow[],
  keyFn: (r: FaturamentoSaleRow) => string
): Map<string, FaturamentoAgg> {
  const buckets = new Map<string, FaturamentoSaleRow[]>()
  for (const r of rows) {
    const k = keyFn(r)
    const list = buckets.get(k)
    if (list) list.push(r)
    else buckets.set(k, [r])
  }
  const out = new Map<string, FaturamentoAgg>()
  for (const [k, list] of buckets) {
    out.set(k, aggregateSales(list))
  }
  return out
}
