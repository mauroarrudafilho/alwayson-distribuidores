import { useMemo } from 'react'
import { useProdutos } from '@/hooks/useProdutos'
import { buildSkuIndustriaSet } from '@/lib/sku-industria'

/** Catálogo alwayson_produtos — SKUs confiáveis após de-para Insights/distribuidor. */
export function useSkuIndustriaSet() {
  const { data: produtos = [], isPending } = useProdutos()
  const set = useMemo(() => buildSkuIndustriaSet(produtos), [produtos])
  return { skusIndustria: set, isPending }
}
