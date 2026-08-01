import { useEffect, useMemo, useState } from 'react'
import type { CidadePerCapita } from '@/lib/insights-per-capita'
import type { InsightsTopCliente } from '@/types/insights'
import {
  buildGapsContext,
  suggestClientesExclusaoPotencial,
  type GapsContext,
} from '@/lib/insights-gap-per-capita'
import { insightsCnpjKey } from '@/hooks/useInsightsQueries'

const STORAGE_KEY = 'insights.potencial.excluidos.cnpj.v1'

function loadStored(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return new Set()
    return new Set(arr.map((x) => insightsCnpjKey(String(x))).filter((k) => k.length === 14))
  } catch {
    return new Set()
  }
}

function persist(keys: Set<string>) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...keys]))
  } catch {
    // ignore
  }
}

/**
 * Parametrização Insights: CNPJs fora do cálculo de potencial (não afeta fat./hab exibido).
 */
export function useInsightsPotencialExclusions(
  cidades: CidadePerCapita[],
  clientes: InsightsTopCliente[]
) {
  const [excluded, setExcluded] = useState<Set<string>>(() => new Set())
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setExcluded(loadStored())
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    persist(excluded)
  }, [excluded, hydrated])

  const suggestions = useMemo(
    () => suggestClientesExclusaoPotencial(clientes, cidades),
    [clientes, cidades]
  )

  const gapsCtx: GapsContext = useMemo(
    () => buildGapsContext(cidades, clientes, excluded),
    [cidades, clientes, excluded]
  )

  function commit(next: Set<string>) {
    setExcluded(next)
  }

  function toggle(cnpjRaw: string) {
    const cnpj = insightsCnpjKey(cnpjRaw)
    if (cnpj.length !== 14) return
    const next = new Set(excluded)
    if (next.has(cnpj)) next.delete(cnpj)
    else next.add(cnpj)
    commit(next)
  }

  function setExcludedFlag(cnpjRaw: string, fora: boolean) {
    const cnpj = insightsCnpjKey(cnpjRaw)
    if (cnpj.length !== 14) return
    const next = new Set(excluded)
    if (fora) next.add(cnpj)
    else next.delete(cnpj)
    commit(next)
  }

  function addSuggested() {
    const next = new Set(excluded)
    for (const s of suggestions) next.add(s.cnpj)
    commit(next)
  }

  function clearAll() {
    commit(new Set())
  }

  const excludedClientes = useMemo(() => {
    const by = new Map(clientes.map((c) => [insightsCnpjKey(c.cnpj_cliente), c] as const))
    return [...excluded]
      .map((cnpj) => by.get(cnpj))
      .filter((c): c is InsightsTopCliente => !!c)
      .sort((a, b) => b.faturamento_total - a.faturamento_total)
  }, [excluded, clientes])

  return {
    excluded,
    excludedClientes,
    suggestions,
    gapsCtx,
    toggle,
    setExcludedFlag,
    addSuggested,
    clearAll,
    count: excluded.size,
  }
}
