import { useEffect, useMemo } from 'react'
import { ChevronRight } from 'lucide-react'
import { PageHeader } from '@/components/distribuidor/PageHeader'
import { FilterBar, FilterField } from '@/components/distribuidor/FilterBar'
import { useDistribuidores } from '@/hooks/useDistribuidores'
import { useVendedorHierarchy } from '@/hooks/usePerformanceHierarchy'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PerformanceProvider, usePerformanceContext } from './performance/PerformanceContext'
import { TAB_LABELS, type PerfTab } from './performance/usePerfFilters'
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
    if (hierarchy) {
      setAvailableTabs(hierarchy.availableLevels)
    }
  }, [hierarchy, setAvailableTabs])

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

  const currentTab = availableTabs.includes(filters.tab) ? filters.tab : availableTabs[0]

  const ActiveTab = useMemo(() => TAB_COMPONENTS[currentTab], [currentTab])

  return (
    <div className="animate-page-in">
      <PageHeader
        title="Sell-out"
        accent="em profundidade"
        description="hierarquia comercial"
      />

      <FilterBar columns={3}>
        <FilterField label="Distribuidor">
          <Select
            value={filters.distribuidorId ?? 'todos'}
            onValueChange={(v) =>
              setFilter('distribuidorId', v === 'todos' ? undefined : (v as string))
            }
          >
            <SelectTrigger className="h-8 text-sm">
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
        <FilterField label="Período Início">
          <Input
            type="month"
            value={filters.periodoInicio ?? ''}
            onChange={(e) =>
              setFilter('periodoInicio', e.target.value || undefined)
            }
            className="h-8 text-sm"
          />
        </FilterField>
        <FilterField label="Período Fim">
          <Input
            type="month"
            value={filters.periodoFim ?? ''}
            onChange={(e) =>
              setFilter('periodoFim', e.target.value || undefined)
            }
            className="h-8 text-sm"
          />
        </FilterField>
      </FilterBar>

      <Tabs
        value={currentTab}
        onValueChange={(v) => setFilter('tab', v as PerfTab)}
      >
        <TabsList
          variant="line"
          className="mb-2 h-auto gap-1 overflow-x-auto border-0 border-b border-border/50 bg-transparent p-0"
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
          <div className="mb-4 flex items-center gap-1 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            {breadcrumbs.map((crumb, idx) => (
              <span key={idx} className="flex items-center gap-1">
                {idx > 0 && <ChevronRight className="h-3 w-3" />}
                <button
                  type="button"
                  className="transition-colors hover:text-foreground hover:underline hover:underline-offset-2"
                  onClick={() => drillDown(crumb.tab, crumb.filters)}
                >
                  {crumb.label}
                </button>
              </span>
            ))}
            <ChevronRight className="h-3 w-3" />
            <span className="font-medium normal-case tracking-normal text-foreground">
              {TAB_LABELS[currentTab]}
            </span>
          </div>
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
