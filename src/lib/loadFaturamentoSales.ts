import { supabase } from '@/lib/supabase'
import type { FaturamentoSaleRow } from '@/lib/faturamentoAgg'
import { monthEnd, monthStart } from '@/lib/periodo'

const PAGE = 1000

type FatRow = {
  id: string
  distribuidor_id: string
  vendedor_id: string
  cliente_id: string
  numero_nf: string
  data_emissao: string
  valor_total: number
}

async function fetchFaturamentoRows(opts: {
  distribuidorId?: string
  periodoInicio?: string
  periodoFim?: string
}): Promise<FatRow[]> {
  const all: FatRow[] = []
  let from = 0
  for (;;) {
    let q = supabase
      .from('alwayson_faturamento')
      .select(
        'id, distribuidor_id, vendedor_id, cliente_id, numero_nf, data_emissao, valor_total'
      )
      .order('data_emissao', { ascending: true })
      .range(from, from + PAGE - 1)

    if (opts.distribuidorId) q = q.eq('distribuidor_id', opts.distribuidorId)
    if (opts.periodoInicio) q = q.gte('data_emissao', monthStart(opts.periodoInicio))
    if (opts.periodoFim) q = q.lte('data_emissao', monthEnd(opts.periodoFim))

    const { data, error } = await q
    if (error) throw error
    const chunk = (data ?? []) as FatRow[]
    all.push(...chunk)
    if (chunk.length < PAGE) break
    from += PAGE
  }
  return all
}

async function fetchSkusByFaturamento(
  faturamentoIds: string[]
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>()
  if (!faturamentoIds.length) return map

  for (let i = 0; i < faturamentoIds.length; i += 200) {
    const slice = faturamentoIds.slice(i, i + 200)
    let from = 0
    for (;;) {
      const { data, error } = await supabase
        .from('alwayson_faturamento_itens')
        .select('faturamento_id, sku')
        .in('faturamento_id', slice)
        .range(from, from + PAGE - 1)
      if (error) throw error
      const chunk = data ?? []
      for (const row of chunk) {
        const list = map.get(row.faturamento_id)
        if (list) list.push(row.sku)
        else map.set(row.faturamento_id, [row.sku])
      }
      if (chunk.length < PAGE) break
      from += PAGE
    }
  }
  return map
}

export async function loadFaturamentoSales(opts: {
  distribuidorId?: string
  periodoInicio?: string
  periodoFim?: string
}): Promise<FaturamentoSaleRow[]> {
  const fats = await fetchFaturamentoRows(opts)
  const skuMap = await fetchSkusByFaturamento(fats.map((f) => f.id))
  return fats.map((f) => ({
    id: f.id,
    distribuidor_id: f.distribuidor_id,
    vendedor_id: f.vendedor_id,
    cliente_id: f.cliente_id,
    numero_nf: f.numero_nf,
    data_emissao: f.data_emissao,
    valor_total: Number(f.valor_total),
    skus: skuMap.get(f.id) ?? [],
  }))
}
