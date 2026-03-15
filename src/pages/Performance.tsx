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
    <div className="animate-fade-in">
      <PageHeader
        title="Performance"
        description="Análise de sell-out por profundidade hierárquica"
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
              <SelectValue />
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
        <TabsList variant="line" className="mb-2">
          {availableTabs.map((tab) => (
            <TabsTrigger key={tab} value={tab} className="text-sm px-3">
              {TAB_LABELS[tab]}
            </TabsTrigger>
          ))}
        </TabsList>

        {breadcrumbs.length > 0 && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-4">
            {breadcrumbs.map((crumb, idx) => (
              <span key={idx} className="flex items-center gap-1">
                {idx > 0 && <ChevronRight className="h-3 w-3" />}
                <button
                  type="button"
                  className="hover:text-foreground transition-colors underline-offset-2 hover:underline"
                  onClick={() => drillDown(crumb.tab, crumb.filters)}
                >
                  {crumb.label}
                </button>
              </span>
            ))}
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground font-medium">
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
