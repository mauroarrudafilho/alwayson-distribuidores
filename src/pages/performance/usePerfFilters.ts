import { useSearchParams } from 'react-router-dom'
import { useCallback } from 'react'
import type { MetricaAnalise } from '@/lib/metrica-analise'

/** Mês corrente menos N meses, formato 'YYYY-MM'. */
function getMonthOffset(monthsBack: number): string {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - monthsBack)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
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
  /** Mês de análise (YYYY-MM) — início e fim são sempre iguais. */
  periodoMes?: string
  /** Métrica exibida nos modais e detalhes (R$ ou unidade). */
  metrica: MetricaAnalise
  /** @deprecated Use periodoMes — mantido igual para hooks existentes. */
  periodoInicio?: string
  /** @deprecated Use periodoMes — mantido igual para hooks existentes. */
  periodoFim?: string
}

const PARAM_MAP: Record<keyof Omit<PerfFilters, 'tab'>, string> = {
  distribuidorId: 'distribuidor',
  gerenteId: 'gerente',
  supervisorId: 'supervisor',
  vendedorId: 'vendedor',
  periodoMes: 'periodo',
  periodoInicio: 'periodo_inicio',
  periodoFim: 'periodo_fim',
  metrica: 'metrica',
}

function toParamName(key: keyof PerfFilters): string {
  if (key === 'tab') return 'tab'
  return PARAM_MAP[key]
}

function readPeriodoMes(searchParams: URLSearchParams): string {
  return (
    searchParams.get('periodo') ||
    searchParams.get('periodo_inicio') ||
    getMonthOffset(2)
  )
}

function applyPeriodoMes(next: URLSearchParams, value: string | undefined) {
  if (value) {
    next.set('periodo', value)
    next.set('periodo_inicio', value)
    next.set('periodo_fim', value)
  } else {
    next.delete('periodo')
    next.delete('periodo_inicio')
    next.delete('periodo_fim')
  }
}

export function usePerfFilters() {
  const [searchParams, setSearchParams] = useSearchParams()

  const periodoMes = readPeriodoMes(searchParams)

  const filters: PerfFilters = {
    tab: (searchParams.get('tab') as PerfTab) || 'distribuidor',
    distribuidorId: searchParams.get('distribuidor') || undefined,
    gerenteId: searchParams.get('gerente') || undefined,
    supervisorId: searchParams.get('supervisor') || undefined,
    vendedorId: searchParams.get('vendedor') || undefined,
    periodoMes,
    periodoInicio: periodoMes,
    periodoFim: periodoMes,
    metrica:
      searchParams.get('metrica') === 'unidade' ? 'unidade' : 'faturamento',
  }

  const setFilter = useCallback(
    (key: keyof PerfFilters, value: string | undefined) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        if (key === 'periodoMes' || key === 'periodoInicio' || key === 'periodoFim') {
          applyPeriodoMes(next, value)
          return next
        }
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
          if (
            key === 'periodoMes' ||
            key === 'periodoInicio' ||
            key === 'periodoFim'
          ) {
            applyPeriodoMes(next, value as string | undefined)
            continue
          }
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
