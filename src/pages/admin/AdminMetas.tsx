import { useState } from 'react'
import { Target } from 'lucide-react'
import { FilterBar, FilterField } from '@/components/distribuidor/FilterBar'
import { useMetas } from '@/hooks/useMetas'
import { useDistribuidores } from '@/hooks/useDistribuidores'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDate } from '@/lib/format'

const HIERARQUIA_OPCOES = [
  { value: 'todos', label: 'Todos' },
  { value: 'distribuidor', label: 'Distribuidor' },
  { value: 'gerente', label: 'Gerente' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'vendedor', label: 'Vendedor' },
] as const

const TIPO_OPCOES = [
  { value: 'todos', label: 'Todos' },
  { value: 'faturamento', label: 'Faturamento' },
  { value: 'positivacao', label: 'Positivacao' },
  { value: 'mix', label: 'Mix' },
  { value: 'clientes_excelencia', label: 'Clientes Excelencia' },
] as const

function AtingimentoCell({ percentual }: { percentual: number }) {
  const cn =
    percentual >= 100
      ? 'text-emerald-600'
      : percentual >= 80
        ? 'text-amber-600'
        : 'text-red-600'
  return <span className={cn}>{percentual.toFixed(1)}%</span>
}

export function AdminMetas() {
  const { data: metas, isLoading } = useMetas()
  const { data: distribuidores } = useDistribuidores()
  const [distribuidorFilter, setDistribuidorFilter] = useState<string>('todos')
  const [hierarquiaFilter, setHierarquiaFilter] = useState<string>('todos')
  const [tipoFilter, setTipoFilter] = useState<string>('todos')

  const filtered = (metas ?? []).filter((m) => {
    const matchDist =
      distribuidorFilter === 'todos' || m.distribuidor_id === distribuidorFilter
    const matchHier =
      hierarquiaFilter === 'todos' || m.hierarquia === hierarquiaFilter
    const matchTipo = tipoFilter === 'todos' || m.tipo === tipoFilter
    return matchDist && matchHier && matchTipo
  })

  return (
    <div>
      <FilterBar>
        <FilterField label="Distribuidor">
          <Select
            value={distribuidorFilter}
            onValueChange={(v) => setDistribuidorFilter(v ?? 'todos')}
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
        <FilterField label="Hierarquia">
          <Select
            value={hierarquiaFilter}
            onValueChange={(v) => setHierarquiaFilter(v ?? 'todos')}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HIERARQUIA_OPCOES.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label="Tipo">
          <Select
            value={tipoFilter}
            onValueChange={(v) => setTipoFilter(v ?? 'todos')}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIPO_OPCOES.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
      </FilterBar>

      <Card>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Distribuidor</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead>Hierarquia</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Período</TableHead>
              <TableHead className="text-right">Meta</TableHead>
              <TableHead className="text-right">Realizado</TableHead>
              <TableHead className="text-right">Atingimento</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center">
                  <Target className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">
                    Nenhuma meta encontrada
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="text-xs font-medium">
                    {m.alwayson_distribuidores?.nome ?? '—'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {m.alwayson_vendedores_distribuidor?.nome ?? '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-[10px]">
                      {m.hierarquia}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {m.tipo}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(m.periodo_inicio)} – {formatDate(m.periodo_fim)}
                  </TableCell>
                  <TableCell className="text-xs tabular-nums text-right">
                    {formatCurrency(m.valor_meta)}
                  </TableCell>
                  <TableCell className="text-xs tabular-nums text-right">
                    {formatCurrency(m.valor_realizado)}
                  </TableCell>
                  <TableCell className="text-xs tabular-nums text-right">
                    <AtingimentoCell percentual={m.percentual_atingimento} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
