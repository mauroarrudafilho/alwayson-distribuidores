import { useState } from 'react'
import { Target, TrendingUp, CheckCircle2, XCircle } from 'lucide-react'
import { PageHeader } from '@/components/distribuidor/PageHeader'
import { KPICard } from '@/components/distribuidor/KPICard'
import { KPIGrid } from '@/components/distribuidor/KPIGrid'
import { MetaProgressBar } from '@/components/distribuidor/MetaProgressBar'
import { SectionTitle } from '@/components/distribuidor/SectionTitle'
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

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

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
    <div>
      <PageHeader
        title="Gestão de Metas"
        description="Acompanhamento de metas por distribuidor e hierarquia"
      />

      <Card className="rounded-md border border-border/50 shadow-none mb-4">
        <CardContent className="p-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                Distribuidor
              </label>
              <Select value={distribuidorFilter} onValueChange={setDistribuidorFilter}>
                <SelectTrigger className="h-8 text-xs shadow-none border-border/50">
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
            </div>
          </div>
        </CardContent>
      </Card>

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

      <Card className="rounded-md border border-border/50 shadow-none mt-4">
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
