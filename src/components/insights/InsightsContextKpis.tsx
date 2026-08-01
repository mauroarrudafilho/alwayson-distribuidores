import type { LucideIcon } from 'lucide-react'
import { KPIGrid } from '@/components/distribuidor/KPIGrid'
import { KPICard } from '@/components/distribuidor/KPICard'
import type { ContextualKpi } from '@/lib/insights-contextual-kpis'

const ICONS: Record<string, LucideIcon> = {}

type Props = {
  kpis: ContextualKpi[]
  icons: Record<string, LucideIcon>
  columns?: 2 | 3 | 4 | 5
  className?: string
}

export function InsightsContextKpis({ kpis, icons, columns = 4, className }: Props) {
  return (
    <KPIGrid columns={columns} className={className}>
      {kpis.map((kpi) => {
        const Icon = icons[kpi.id] ?? icons.default
        if (!Icon) return null
        return (
          <KPICard
            key={kpi.id}
            label={kpi.label}
            value={kpi.value}
            icon={Icon}
            subtitle={kpi.subtitle}
            variant={kpi.variant ?? 'default'}
          />
        )
      })}
    </KPIGrid>
  )
}

export { ICONS }
