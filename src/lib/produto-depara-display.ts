import type { LocalMixSku } from '@/hooks/useClienteMixLocal'
import { normalizeDeParaCellValue } from '@/lib/parseDeParaProdutoUpload'
import { normalizeSkuIndustriaKey } from '@/lib/sku-industria'

export function buildDeParaMap(
  rows: { codigo_cliente: string; sku_fornecedor: string }[]
): Map<string, string> {
  const map = new Map<string, string>()
  for (const row of rows) {
    map.set(row.codigo_cliente.trim(), row.sku_fornecedor.trim())
  }
  return map
}

/** SKU oficial → descrição cadastro indústria (`alwayson_produtos`). */
export function buildProdutoDescricaoMap(
  produtos: { sku: string; descricao: string }[]
): Map<string, string> {
  const map = new Map<string, string>()
  for (const p of produtos) {
    const k = p.sku.trim()
    if (!k) continue
    map.set(k, p.descricao)
    const norm = normalizeDeParaCellValue(k)
    if (norm) map.set(norm, p.descricao)
    const ind = normalizeSkuIndustriaKey(k)
    if (ind) map.set(ind, p.descricao)
  }
  return map
}

export function resolveSkuViaDePara(
  codigoCliente: string,
  dePara: Map<string, string>
): string {
  return dePara.get(codigoCliente.trim()) ?? codigoCliente.trim()
}

export function lookupProdutoDescricao(
  sku: string,
  descricoes: Map<string, string>
): string | undefined {
  const s = sku.trim()
  if (!s) return undefined
  return (
    descricoes.get(s) ??
    descricoes.get(normalizeDeParaCellValue(s)) ??
    descricoes.get(normalizeSkuIndustriaKey(s))
  )
}

/** Substitui descrição do sell-in pela do catálogo após de-para distribuidor. */
export function enrichMixComDePara(
  rows: LocalMixSku[],
  dePara: Map<string, string>,
  descricoes: Map<string, string>
): LocalMixSku[] {
  return rows.map((row) => {
    const skuIndustria = resolveSkuViaDePara(row.sku, dePara)
    const descricao =
      lookupProdutoDescricao(skuIndustria, descricoes) ?? row.descricao
    return {
      ...row,
      sku: skuIndustria,
      descricao,
    }
  })
}

export type ItemEnriquecido = {
  sku: string
  descricao: string
  quantidade: number
  valor_total: number
}

export function enrichFaturamentoItem(
  item: { sku: string; descricao: string; quantidade: number; valor_total: number },
  dePara: Map<string, string>,
  descricoes: Map<string, string>
): ItemEnriquecido {
  const sku = resolveSkuViaDePara(item.sku, dePara)
  const descricao = lookupProdutoDescricao(sku, descricoes) ?? item.descricao
  return {
    sku,
    descricao,
    quantidade: item.quantidade,
    valor_total: item.valor_total,
  }
}

export function enrichFaturamentoItens(
  itens: { sku: string; descricao: string; quantidade: number; valor_total: number }[],
  dePara: Map<string, string>,
  descricoes: Map<string, string>
): ItemEnriquecido[] {
  return itens.map((item) => enrichFaturamentoItem(item, dePara, descricoes))
}
