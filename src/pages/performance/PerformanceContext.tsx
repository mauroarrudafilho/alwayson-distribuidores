import { createContext, useContext, useState, useMemo, useCallback, type ReactNode } from 'react'
import { usePerfFilters, TAB_ORDER, type PerfFilters, type PerfTab } from './usePerfFilters'

interface Breadcrumb {
  label: string
  tab: PerfTab
  filters: Partial<PerfFilters>
}

interface PerformanceContextValue {
  filters: PerfFilters
  setFilter: (key: keyof PerfFilters, value: string | undefined) => void
  drillDown: (level: PerfTab, filters: Partial<PerfFilters>) => void
  breadcrumbs: Breadcrumb[]
  availableTabs: PerfTab[]
  setAvailableTabs: (tabs: PerfTab[]) => void
  registerNames: (map: Record<string, string>) => void
}

const Ctx = createContext<PerformanceContextValue | null>(null)

export function usePerformanceContext() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('usePerformanceContext must be used within PerformanceProvider')
  return ctx
}

export function PerformanceProvider({ children }: { children: ReactNode }) {
  const { filters, setFilter, drillDown } = usePerfFilters()
  const [availableTabs, setAvailableTabs] = useState<PerfTab[]>(['distribuidor', 'vendas', 'cliente'])
  const [names, setNames] = useState<Record<string, string>>({})

  const registerNames = useCallback((map: Record<string, string>) => {
    setNames((prev) => ({ ...prev, ...map }))
  }, [])

  const breadcrumbs = useMemo(() => {
    const crumbs: Breadcrumb[] = []
    const { tab, distribuidorId, gerenteId, supervisorId, vendedorId } = filters
    const tabIdx = TAB_ORDER.indexOf(tab)

    if (distribuidorId && tabIdx > 0) {
      crumbs.push({
        label: names[distribuidorId] || 'Distribuidor',
        tab: 'distribuidor',
        filters: {},
      })
    }

    if (gerenteId && tabIdx > TAB_ORDER.indexOf('gerencia')) {
      crumbs.push({
        label: names[gerenteId] || 'Gerente',
        tab: 'gerencia',
        filters: { distribuidorId },
      })
    }

    if (supervisorId && tabIdx > TAB_ORDER.indexOf('supervisao')) {
      crumbs.push({
        label: names[supervisorId] || 'Supervisor',
        tab: 'supervisao',
        filters: { distribuidorId, gerenteId },
      })
    }

    if (vendedorId && tabIdx > TAB_ORDER.indexOf('vendas')) {
      crumbs.push({
        label: names[vendedorId] || 'Vendedor',
        tab: 'vendas',
        filters: { distribuidorId, gerenteId, supervisorId },
      })
    }

    return crumbs
  }, [filters, names])

  const value = useMemo<PerformanceContextValue>(
    () => ({
      filters,
      setFilter,
      drillDown,
      breadcrumbs,
      availableTabs,
      setAvailableTabs,
      registerNames,
    }),
    [filters, setFilter, drillDown, breadcrumbs, availableTabs, registerNames]
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
