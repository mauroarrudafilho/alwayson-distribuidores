import type { InsightsClienteMixRow } from '@/types/insights'
import type { LocalMixSku } from '@/hooks/useClienteMixLocal'
import { isSkuIndustriaConfiavel } from '@/lib/sku-industria'

export type MixItemStatus = 'continuidade' | 'historico' | 'novo'

export type MixCorrelacaoRow = {
  /** SKU normatizado indústria (alwayson_produtos.sku). */
  sku: string
  descricao: string
  status: MixItemStatus
  fatHistorico: number | null
  fatLocal: number | null
  qtdHistorico: number | null
  qtdLocal: number | null
  mesesHistorico: number | null
}

export type MixCorrelacaoResumo = {
  rows: MixCorrelacaoRow[]
  totalHistorico: number
  continuidade: number
  soHistorico: number
  soLocal: number
  /** Linhas históricas/locais descartadas por SKU sem de-para indústria. */
  ignoradosSemDePara: number
}

const statusOrder: Record<MixItemStatus, number> = {
  continuidade: 0,
  historico: 1,
  novo: 2,
}

function normalizeLocalSku(
  sku: string,
  deParaLocal?: Map<string, string>
): string {
  return deParaLocal?.get(sku.trim()) ?? sku.trim()
}

export function sortMixRows(
  rows: MixCorrelacaoRow[],
  metrica: 'faturamento' | 'unidade',
  sortCol: 'default' | 'hist' | 'atual',
  sortDir: 'asc' | 'desc'
): MixCorrelacaoRow[] {
  const val = (row: MixCorrelacaoRow, col: 'hist' | 'atual') => {
    if (metrica === 'faturamento') {
      return col === 'hist' ? row.fatHistorico ?? 0 : row.fatLocal ?? 0
    }
    return col === 'hist' ? row.qtdHistorico ?? 0 : row.qtdLocal ?? 0
  }

  const sorted = [...rows]
  sorted.sort((a, b) => {
    if (sortCol === 'default') {
      const so = statusOrder[a.status] - statusOrder[b.status]
      if (so !== 0) return so
      return val(b, 'hist') + val(b, 'atual') - (val(a, 'hist') + val(a, 'atual'))
    }
    const cmp = val(a, sortCol) - val(b, sortCol)
    return sortDir === 'asc' ? cmp : -cmp
  })
  return sorted
}

export function correlacionarMix(
  insightsMix: InsightsClienteMixRow[],
  localMix: LocalMixSku[],
  deParaLocal?: Map<string, string>,
  skusIndustria?: Set<string>
): MixCorrelacaoResumo {
  const confiavel = (sku: string) =>
    !skusIndustria || skusIndustria.size === 0 || isSkuIndustriaConfiavel(sku, skusIndustria)

  const insightsFiltrado = insightsMix.filter((r) => confiavel(r.sku))

  const localNormalized = localMix
    .map((r) => ({
      ...r,
      skuKey: normalizeLocalSku(r.sku, deParaLocal),
    }))
    .filter((r) => confiavel(r.skuKey))

  const ignoradosSemDePara =
    insightsMix.length -
    insightsFiltrado.length +
    localMix.filter((r) => !confiavel(normalizeLocalSku(r.sku, deParaLocal))).length

  const localBySku = new Map(localNormalized.map((r) => [r.skuKey, r]))
  const histBySku = new Map(insightsFiltrado.map((r) => [r.sku.trim(), r]))
  const allSkus = new Set([...localBySku.keys(), ...histBySku.keys()])

  const rows: MixCorrelacaoRow[] = []

  for (const sku of allSkus) {
    const h = histBySku.get(sku)
    const l = localBySku.get(sku)
    let status: MixItemStatus
    if (h && l) status = 'continuidade'
    else if (h) status = 'historico'
    else status = 'novo'

    rows.push({
      sku,
      descricao: h?.descricao?.trim() || l?.descricao || sku,
      status,
      fatHistorico: h?.faturamento_total ?? null,
      fatLocal: l?.faturamento_total ?? null,
      qtdHistorico: h?.quantidade_total ?? null,
      qtdLocal: l?.quantidade_total ?? null,
      mesesHistorico: h?.meses_ativos ?? null,
    })
  }

  return {
    rows: sortMixRows(rows, 'faturamento', 'default', 'desc'),
    totalHistorico: insightsFiltrado.length,
    continuidade: rows.filter((r) => r.status === 'continuidade').length,
    soHistorico: rows.filter((r) => r.status === 'historico').length,
    soLocal: rows.filter((r) => r.status === 'novo').length,
    ignoradosSemDePara,
  }
}
