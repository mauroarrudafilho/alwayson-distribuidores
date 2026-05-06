import { useSearchParams } from 'react-router-dom'
import { useCallback } from 'react'

function getCurrentMonth(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

export type PerfTab = 'distribuidor' | 'gerencia' | 'supervisao' | 'vendas' | 'cliente'

export const TAB_ORDER: PerfTab[] = ['distribuidor', 'gerencia', 'supervisao', 'vendas', 'cliente']

export const TAB_LABELS: Record<PerfTab, string> = {
  distribuidor: 'Distribuidor',
  gerencia: 'Gerência',
  supervisao: 'Supervisão',
  vendas: 'Vendas',
  cliente: 'Cliente',
}

export interface PerfFilters {
  tab: PerfTab
  distribuidorId?: string
  gerenteId?: string
  supervisorId?: string
  vendedorId?: string
  periodoInicio?: string
  periodoFim?: string
}

const PARAM_MAP: Record<keyof Omit<PerfFilters, 'tab'>, string> = {
  distribuidorId: 'distribuidor',
  gerenteId: 'gerente',
  supervisorId: 'supervisor',
  vendedorId: 'vendedor',
  periodoInicio: 'periodo_inicio',
  periodoFim: 'periodo_fim',
}

function toParamName(key: keyof PerfFilters): string {
  if (key === 'tab') return 'tab'
  return PARAM_MAP[key]
}

export function usePerfFilters() {
  const [searchParams, setSearchParams] = useSearchParams()

  const filters: PerfFilters = {
    tab: (searchParams.get('tab') as PerfTab) || 'distribuidor',
    distribuidorId: searchParams.get('distribuidor') || undefined,
    gerenteId: searchParams.get('gerente') || undefined,
    supervisorId: searchParams.get('supervisor') || undefined,
    vendedorId: searchParams.get('vendedor') || undefined,
    periodoInicio: searchParams.get('periodo_inicio') || getCurrentMonth(),
    periodoFim: searchParams.get('periodo_fim') || getCurrentMonth(),
  }

  const setFilter = useCallback(
    (key: keyof PerfFilters, value: string | undefined) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        const paramName = toParamName(key)
        if (value) {
          next.set(paramName, value)
        } else {
          next.delete(paramName)
        }
        return next
      })
    },
    [setSearchParams]
  )

  const drillDown = useCallback(
    (tab: PerfTab, newFilters: Partial<PerfFilters>) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        next.set('tab', tab)
        for (const [key, value] of Object.entries(newFilters)) {
          if (key === 'tab') continue
          const paramName = toParamName(key as keyof PerfFilters)
          if (value) {
            next.set(paramName, value as string)
          }
        }
        return next
      })
    },
    [setSearchParams]
  )

  return { filters, setFilter, drillDown }
}
