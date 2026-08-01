import { normalizeDeParaCellValue } from '@/lib/parseDeParaProdutoUpload'

/** Chave comparável para bater SKU bruto com alwayson_produtos.sku. */
export function normalizeSkuIndustriaKey(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  return normalizeDeParaCellValue(trimmed) || trimmed
}

/** Set de SKUs oficiais (alwayson_produtos) com variantes normalizadas. */
export function buildSkuIndustriaSet(produtos: { sku: string }[]): Set<string> {
  const set = new Set<string>()
  for (const p of produtos) {
    const sku = p.sku.trim()
    if (!sku) continue
    set.add(sku)
    const norm = normalizeSkuIndustriaKey(sku)
    if (norm) set.add(norm)
  }
  return set
}

/** SKU resolvido no catálogo indústria (via de-para Insights ou cadastro oficial). */
export function isSkuIndustriaConfiavel(sku: string, catalog: Set<string>): boolean {
  if (catalog.size === 0) return true
  const s = sku.trim()
  if (!s) return false
  if (catalog.has(s)) return true
  const norm = normalizeSkuIndustriaKey(s)
  return catalog.has(norm)
}

export function filtrarPorSkuConfiavel<T extends { sku: string }>(
  rows: T[],
  catalog: Set<string> | undefined
): T[] {
  if (!catalog || catalog.size === 0) return rows
  return rows.filter((r) => isSkuIndustriaConfiavel(r.sku, catalog))
}
