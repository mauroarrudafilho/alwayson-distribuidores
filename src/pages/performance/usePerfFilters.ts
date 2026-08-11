import { useSearchParams } from 'react-router-dom'
import { useCallback } from 'react'
import type { MetricaAnalise } from '@/lib/metrica-analise'
import {
  calcularJanela,
  type ComparacaoModo,
  type JanelaMeses,
} from '@/lib/janela-periodo'

export type PerfTab = 'distribuidor' | 'gerencia' | 'supervisao' | 'vendas' | 'cliente'

export const TAB_ORDER: PerfTab[] = ['distribuidor', 'gerencia', 'supervisao', 'vendas', 'cliente']

/** Próximo nível hierárquico disponível após `current`. */
export function nextTabInOrder(current: PerfTab, available: PerfTab[]): PerfTab {
  const start = TAB_ORDER.indexOf(current)
  for (let i = start + 1; i < TAB_ORDER.length; i++) {
    const candidate = TAB_ORDER[i]
    if (available.includes(candidate)) return candidate
  }
  return current
}

/** Garante aba válida; se o nível pedido não existir, avança para o próximo disponível. */
export function resolvePerfTab(requested: PerfTab, available: PerfTab[]): PerfTab {
  if (available.includes(requested)) return requested
  const start = TAB_ORDER.indexOf(requested)
  for (let i = start; i < TAB_ORDER.length; i++) {
    const candidate = TAB_ORDER[i]
    if (available.includes(candidate)) return candidate
  }
  return available[0] ?? 'distribuidor'
}

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
  /** Tamanho da janela em meses; 0 = série inteira. */
  janela: JanelaMeses
  /** Contra o que comparar a janela. */
  comparar: ComparacaoModo
  /**
   * Início da janela (YYYY-MM) — derivado, consumido pelas tabelas.
   * Sempre populado: `calcularJanela` é a única origem e nunca devolve
   * campo vazio, por isso o tipo é obrigatório, não opcional.
   */
  periodoInicio: string
  /**
   * Fim da janela (YYYY-MM) — derivado, consumido pelas tabelas.
   * Sempre populado: `calcularJanela` é a única origem e nunca devolve
   * campo vazio, por isso o tipo é obrigatório, não opcional.
   */
  periodoFim: string
  /** Métrica exibida nos modais e detalhes (R$ ou unidade). */
  metrica: MetricaAnalise
}

/**
 * Chaves que de fato viram parâmetro de URL. `periodoInicio`/`periodoFim` ficam
 * de fora de propósito: são derivadas de `janela` por `calcularJanela` (ver
 * `PerfFilters`), nunca lidas da URL — mapeá-las aqui deixava `setFilter`
 * escrever um parâmetro que ninguém consome.
 */
export type PerfFilterParamKey = Exclude<keyof PerfFilters, 'periodoInicio' | 'periodoFim'>

const PARAM_MAP: Record<Exclude<PerfFilterParamKey, 'tab'>, string> = {
  distribuidorId: 'distribuidor',
  gerenteId: 'gerente',
  supervisorId: 'supervisor',
  vendedorId: 'vendedor',
  janela: 'janela',
  comparar: 'comparar',
  metrica: 'metrica',
}

function toParamName(key: PerfFilterParamKey): string {
  if (key === 'tab') return 'tab'
  return PARAM_MAP[key]
}

function readJanela(searchParams: URLSearchParams): JanelaMeses {
  const raw = Number(searchParams.get('janela'))
  return raw === 6 || raw === 24 || raw === 0 ? raw : 12
}

function readComparar(searchParams: URLSearchParams): ComparacaoModo {
  const raw = searchParams.get('comparar')
  return raw === 'periodo_anterior' || raw === 'nenhum' ? raw : 'ano_anterior'
}

export function usePerfFilters() {
  const [searchParams, setSearchParams] = useSearchParams()

  const janela = readJanela(searchParams)
  const comparar = readComparar(searchParams)
  const periodo = calcularJanela(janela)

  const filters: PerfFilters = {
    tab: (searchParams.get('tab') as PerfTab) || 'distribuidor',
    distribuidorId: searchParams.get('distribuidor') || undefined,
    gerenteId: searchParams.get('gerente') || undefined,
    supervisorId: searchParams.get('supervisor') || undefined,
    vendedorId: searchParams.get('vendedor') || undefined,
    janela,
    comparar,
    periodoInicio: periodo.inicio,
    periodoFim: periodo.fim,
    metrica: searchParams.get('metrica') === 'unidade' ? 'unidade' : 'faturamento',
  }

  const setFilter = useCallback(
    (key: PerfFilterParamKey, value: string | undefined) => {
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
          const paramName = toParamName(key as PerfFilterParamKey)
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
