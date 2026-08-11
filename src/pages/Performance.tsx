import { useEffect, useMemo } from 'react'
import { ChevronRight } from 'lucide-react'
import { PageHeader } from '@/components/distribuidor/PageHeader'
import { FilterBar, FilterField } from '@/components/distribuidor/FilterBar'
import { MetricaToggle } from '@/components/distribuidor/MetricaToggle'
import { useDistribuidores } from '@/hooks/useDistribuidores'
import { useVendedorHierarchy } from '@/hooks/usePerformanceHierarchy'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PerformanceProvider, usePerformanceContext } from './performance/PerformanceContext'
import {
  TAB_LABELS,
  TAB_ORDER,
  resolvePerfTab,
  type PerfTab,
} from './performance/usePerfFilters'
import { DistribuidorTab } from './performance/DistribuidorTab'
import { GerenciaTab } from './performance/GerenciaTab'
import { SupervisaoTab } from './performance/SupervisaoTab'
import { VendasTab } from './performance/VendasTab'
import { ClienteTab } from './performance/ClienteTab'

const TAB_COMPONENTS: Record<PerfTab, React.ComponentType> = {
  distribuidor: DistribuidorTab,
  gerencia: GerenciaTab,
  supervisao: SupervisaoTab,
  vendas: VendasTab,
  cliente: ClienteTab,
}

const JANELA_LABELS: Record<number, string> = {
  6: '6 meses',
  12: '12 meses',
  24: '24 meses',
  0: 'Toda a série',
}

const COMPARAR_LABELS: Record<string, string> = {
  ano_anterior: 'Ano anterior',
  periodo_anterior: 'Período anterior',
  nenhum: 'Nada',
}

function PerformanceContent() {
  const { data: distribuidores } = useDistribuidores()
  const {
    filters,
    setFilter,
    drillDown,
    breadcrumbs,
    availableTabs,
    setAvailableTabs,
    registerNames,
  } = usePerformanceContext()

  const { data: hierarchy } = useVendedorHierarchy(filters.distribuidorId)

  useEffect(() => {
    if (!filters.distribuidorId) {
      setAvailableTabs(['distribuidor', 'vendas', 'cliente'])
      return
    }
    if (hierarchy) {
      const levels = hierarchy.availableLevels
      setAvailableTabs(levels)
      const resolved = resolvePerfTab(filters.tab, levels)
      if (resolved !== filters.tab) {
        setFilter('tab', resolved)
      }
      return
    }
    setAvailableTabs(TAB_ORDER)
  }, [filters.distribuidorId, filters.tab, hierarchy, setAvailableTabs, setFilter])

  useEffect(() => {
    if (!distribuidores) return
    const map: Record<string, string> = {}
    for (const d of distribuidores) {
      map[d.id] = d.nome
    }
    registerNames(map)
  }, [distribuidores, registerNames])

  useEffect(() => {
    if (!hierarchy) return
    const map: Record<string, string> = {}
    for (const v of hierarchy.vendedores) {
      map[v.id] = v.nome
    }
    registerNames(map)
  }, [hierarchy, registerNames])

  const currentTab = resolvePerfTab(filters.tab, availableTabs)

  const ActiveTab = useMemo(() => TAB_COMPONENTS[currentTab], [currentTab])

  return (
    <div className="animate-page-in">
      <PageHeader
        title="Sell-out"
        accent="em profundidade"
        description="hierarquia comercial"
      />

      <FilterBar gridClassName="grid-cols-1 sm:grid-cols-[minmax(0,1fr)_9rem_10rem_auto]">
        <FilterField label="Distribuidor" className="min-w-0">
          <Select
            value={filters.distribuidorId ?? 'todos'}
            onValueChange={(v) =>
              setFilter('distribuidorId', v === 'todos' ? undefined : (v as string))
            }
          >
            <SelectTrigger className="h-8 w-full text-sm">
              <SelectValue placeholder="Selecione...">
                {filters.distribuidorId
                  ? distribuidores?.find((d) => d.id === filters.distribuidorId)?.nome ?? 'Carregando...'
                  : 'Todos'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {(distribuidores ?? []).map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label="Janela">
          <Select
            value={String(filters.janela)}
            onValueChange={(v) => setFilter('janela', v as string)}
          >
            <SelectTrigger className="h-8 w-full text-sm">
              <SelectValue>{JANELA_LABELS[filters.janela]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="6">6 meses</SelectItem>
              <SelectItem value="12">12 meses</SelectItem>
              <SelectItem value="24">24 meses</SelectItem>
              <SelectItem value="0">Toda a série</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label="Comparar com">
          <Select
            value={filters.comparar}
            onValueChange={(v) => setFilter('comparar', v as string)}
          >
            <SelectTrigger className="h-8 w-full text-sm">
              <SelectValue>{COMPARAR_LABELS[filters.comparar]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ano_anterior">Ano anterior</SelectItem>
              <SelectItem value="periodo_anterior">Período anterior</SelectItem>
              <SelectItem value="nenhum">Nada</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label="Métrica">
          <MetricaToggle
            value={filters.metrica}
            onChange={(v) => setFilter('metrica', v)}
          />
        </FilterField>
      </FilterBar>

      <Tabs
        value={currentTab}
        onValueChange={(v) => setFilter('tab', v as PerfTab)}
      >
        <TabsList
          variant="line"
          className="tab-strip mb-2 h-auto gap-1 border-0 border-b border-border/50 bg-transparent p-0"
        >
          {availableTabs.map((tab) => (
            <TabsTrigger
              key={tab}
              value={tab}
              className="rounded-none border-b-2 border-transparent px-2 py-2 text-xs whitespace-nowrap text-muted-foreground data-active:border-teal data-active:font-semibold data-active:text-foreground sm:px-3 sm:text-[13px]"
            >
              {TAB_LABELS[tab]}
            </TabsTrigger>
          ))}
        </TabsList>

        {breadcrumbs.length > 0 && (
          <nav
            aria-label="Caminho na hierarquia"
            className="mb-3 flex flex-wrap items-center gap-x-1 gap-y-0.5 text-xs text-muted-foreground"
          >
            {breadcrumbs.map((crumb, idx) => (
              <span key={idx} className="inline-flex max-w-full items-center gap-1">
                {idx > 0 && (
                  <ChevronRight className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
                )}
                <button
                  type="button"
                  className="max-w-[14rem] truncate transition-colors hover:text-foreground hover:underline hover:underline-offset-2"
                  onClick={() => drillDown(crumb.tab, crumb.filters)}
                >
                  {crumb.label}
                </button>
              </span>
            ))}
            <ChevronRight className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
            <span className="font-medium text-foreground">
              {TAB_LABELS[currentTab]}
            </span>
          </nav>
        )}

        {availableTabs.map((tab) => (
          <TabsContent key={tab} value={tab}>
            {tab === currentTab && <ActiveTab />}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}

export function Performance() {
  return (
    <PerformanceProvider>
      <PerformanceContent />
    </PerformanceProvider>
  )
}
