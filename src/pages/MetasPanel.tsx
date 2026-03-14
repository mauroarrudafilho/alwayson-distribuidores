import { useState } from 'react'
import { Target, TrendingUp, CheckCircle2, XCircle } from 'lucide-react'
import { PageHeader } from '@/components/distribuidor/PageHeader'
import { KPICard } from '@/components/distribuidor/KPICard'
import { KPIGrid } from '@/components/distribuidor/KPIGrid'
import { MetaProgressBar } from '@/components/distribuidor/MetaProgressBar'
import { SectionTitle } from '@/components/distribuidor/SectionTitle'
import { FilterBar, FilterField } from '@/components/distribuidor/FilterBar'
import { useMetas } from '@/hooks/useMetas'
import { useDistribuidores } from '@/hooks/useDistribuidores'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/format'

export function MetasPanel() {
  const [distribuidorFilter, setDistribuidorFilter] = useState<string>('todos')
  const { data: distribuidores } = useDistribuidores()
  const { data: allMetas, isLoading } = useMetas(
    distribuidorFilter === 'todos' ? undefined : distribuidorFilter
  )

  const metas = allMetas ?? []
  const totalMetas = metas.length
  const atingidas = metas.filter((m) => Number(m.percentual_atingimento) >= 100).length
  const emAndamento = metas.filter(
    (m) =>
      Number(m.percentual_atingimento) >= 70 &&
      Number(m.percentual_atingimento) < 100
  ).length
  const abaixo = metas.filter((m) => Number(m.percentual_atingimento) < 70).length

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Gestão de Metas"
        description="Acompanhamento de metas por distribuidor e hierarquia"
      />

      <FilterBar>
        <FilterField label="Distribuidor">
          <Select value={distribuidorFilter} onValueChange={(v) => setDistribuidorFilter(v ?? 'todos')}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os distribuidores</SelectItem>
              {(distribuidores ?? []).map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
      </FilterBar>

      <KPIGrid columns={4}>
        <KPICard label="Total de Metas" value={totalMetas} icon={Target} />
        <KPICard
          label="Atingidas"
          value={atingidas}
          icon={CheckCircle2}
          variant="primary"
        />
        <KPICard label="Em Andamento" value={emAndamento} icon={TrendingUp} />
        <KPICard label="Abaixo" value={abaixo} icon={XCircle} />
      </KPIGrid>

      <Card className="mt-6">
        <CardContent className="p-3">
          <SectionTitle title="Progresso das Metas" icon={Target} />
          {isLoading ? (
            <div className="space-y-3 mt-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : metas.length === 0 ? (
            <p className="text-xs text-muted-foreground py-8 text-center">
              Nenhuma meta cadastrada
            </p>
          ) : (
            <div className="space-y-3 mt-2">
              {metas.map((m) => (
                <MetaProgressBar
                  key={m.id}
                  label={`${m.tipo} — ${m.hierarquia}`}
                  percentual={Number(m.percentual_atingimento)}
                  meta={formatCurrency(Number(m.valor_meta))}
                  realizado={formatCurrency(Number(m.valor_realizado))}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
