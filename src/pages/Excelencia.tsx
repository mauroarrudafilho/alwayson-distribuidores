import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Award, Users, CheckCircle2, AlertTriangle, XCircle, ArrowUpDown } from 'lucide-react'
import { PageHeader } from '@/components/distribuidor/PageHeader'
import { FilterBar, FilterField } from '@/components/distribuidor/FilterBar'
import { KPIGrid } from '@/components/distribuidor/KPIGrid'
import { KPICard } from '@/components/distribuidor/KPICard'
import { Card, CardContent } from '@/components/ui/card'
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
import { Skeleton } from '@/components/ui/skeleton'
import { useDistribuidores } from '@/hooks/useDistribuidores'
import { useExcelenciaConfigs, useExcelenciaClientes } from '@/hooks/useExcelenciaConfig'
import type { ExcelenciaConfig } from '@/types/excelencia'
import type { ClienteDistribuidor } from '@/types/distribuidor'
import { cn } from '@/lib/utils'

type StatusFilter = 'todos' | 'aderentes' | 'em_risco' | 'fora_do_padrao'
type SortField = 'cliente' | 'score' | string
type SortDir = 'asc' | 'desc'

interface CriterioCell {
  criterio_nome: string
  meta: number
  realizado: number | null
  status: 'verde' | 'amarelo' | 'vermelho' | 'sem_dados'
}

interface MonitorRow {
  cliente_id: string
  cliente_nome: string
  criterios: CriterioCell[]
  score: number
  scoreLabel: 'aderente' | 'em_risco' | 'fora_do_padrao'
}

function resolveRealizado(
  config: ExcelenciaConfig,
  cliente: ClienteDistribuidor
): number | null {
  const nome = config.criterio_nome.toLowerCase()
  if (nome.includes('iten') || nome.includes('cadastr')) {
    return cliente.itens_cadastrados ?? null
  }
  if (nome.includes('frequ') || nome.includes('recorr')) {
    return cliente.frequencia_compra_dias ?? null
  }
  return null
}

function resolveStatus(
  realizado: number | null,
  meta: number,
  tipo: 'min' | 'max'
): 'verde' | 'amarelo' | 'vermelho' | 'sem_dados' {
  if (realizado === null) return 'sem_dados'
  if (tipo === 'min') {
    if (realizado >= meta) return 'verde'
    if (realizado >= meta * 0.7) return 'amarelo'
    return 'vermelho'
  }
  if (realizado <= meta) return 'verde'
  if (realizado <= meta * 1.3) return 'amarelo'
  return 'vermelho'
}

function deriveScoreLabel(criterios: CriterioCell[]): 'aderente' | 'em_risco' | 'fora_do_padrao' {
  const valid = criterios.filter((c) => c.status !== 'sem_dados')
  if (valid.length === 0) return 'fora_do_padrao'
  const allGreen = valid.every((c) => c.status === 'verde')
  if (allGreen) return 'aderente'
  const redCount = valid.filter((c) => c.status === 'vermelho').length
  if (redCount > valid.length / 2) return 'fora_do_padrao'
  return 'em_risco'
}

const STATUS_CELL_CLASSES: Record<string, string> = {
  verde: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400',
  amarelo: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400',
  vermelho: 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400',
  sem_dados: 'text-muted-foreground',
}

export function Excelencia() {
  const [distribuidorId, setDistribuidorId] = useState<string>()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos')
  const [sortField, setSortField] = useState<SortField>('score')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const { data: distribuidores } = useDistribuidores()
  const { data: configs, isLoading: loadingConfigs } = useExcelenciaConfigs(distribuidorId)
  const { data: exClientes, isLoading: loadingClientes } = useExcelenciaClientes(distribuidorId)

  const isLoading = loadingConfigs || loadingClientes

  const rows = useMemo<MonitorRow[]>(() => {
    if (!configs || !exClientes) return []

    return exClientes
      .filter((ec) => ec.cliente)
      .map((ec) => {
        const cliente = ec.cliente
        const criterios: CriterioCell[] = configs.map((cfg) => {
          const realizado = resolveRealizado(cfg, cliente)
          return {
            criterio_nome: cfg.criterio_nome,
            meta: cfg.meta_valor,
            realizado,
            status: resolveStatus(realizado, cfg.meta_valor, cfg.tipo_comparacao),
          }
        })

        const valid = criterios.filter((c) => c.status !== 'sem_dados')
        const met = valid.filter((c) => c.status === 'verde').length
        const score = valid.length > 0 ? Math.round((met / valid.length) * 100) : 0

        return {
          cliente_id: cliente.id,
          cliente_nome: cliente.nome_fantasia || cliente.razao_social,
          criterios,
          score,
          scoreLabel: deriveScoreLabel(criterios),
        }
      })
  }, [configs, exClientes])

  const filteredRows = useMemo(() => {
    let result = rows
    if (statusFilter !== 'todos') {
      result = result.filter((r) => r.scoreLabel === statusFilter.replace('em_risco', 'em_risco'))
      if (statusFilter === 'aderentes') result = rows.filter((r) => r.scoreLabel === 'aderente')
      else if (statusFilter === 'em_risco') result = rows.filter((r) => r.scoreLabel === 'em_risco')
      else if (statusFilter === 'fora_do_padrao') result = rows.filter((r) => r.scoreLabel === 'fora_do_padrao')
    }

    return [...result].sort((a, b) => {
      let cmp = 0
      if (sortField === 'cliente') {
        cmp = a.cliente_nome.localeCompare(b.cliente_nome)
      } else if (sortField === 'score') {
        cmp = a.score - b.score
      } else {
        const aCell = a.criterios.find((c) => c.criterio_nome === sortField)
        const bCell = b.criterios.find((c) => c.criterio_nome === sortField)
        cmp = (aCell?.realizado ?? -1) - (bCell?.realizado ?? -1)
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [rows, statusFilter, sortField, sortDir])

  const kpis = useMemo(() => {
    const total = rows.length
    const aderentes = rows.filter((r) => r.scoreLabel === 'aderente').length
    const emRisco = rows.filter((r) => r.scoreLabel === 'em_risco').length
    const fora = rows.filter((r) => r.scoreLabel === 'fora_do_padrao').length
    return { total, aderentes, emRisco, fora }
  }, [rows])

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir(field === 'cliente' ? 'asc' : 'desc')
    }
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Excelência"
        description="Monitoramento de clientes estratégicos"
      />

      <FilterBar columns={2}>
        <FilterField label="Distribuidor">
          <Select
            value={distribuidorId ?? 'todos'}
            onValueChange={(v) =>
              setDistribuidorId(v === 'todos' ? undefined : (v as string))
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
        <FilterField label="Status">
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as StatusFilter)}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="aderentes">Aderentes</SelectItem>
              <SelectItem value="em_risco">Em risco</SelectItem>
              <SelectItem value="fora_do_padrao">Fora do padrão</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>
      </FilterBar>

      <div className="mb-6">
        <KPIGrid columns={4}>
          <KPICard
            label="Total no Plano"
            value={isLoading ? '—' : kpis.total}
            icon={Users}
          />
          <KPICard
            label="Aderência 100%"
            value={isLoading ? '—' : kpis.aderentes}
            icon={CheckCircle2}
            variant="primary"
          />
          <KPICard
            label="Em Risco"
            value={isLoading ? '—' : kpis.emRisco}
            icon={AlertTriangle}
          />
          <KPICard
            label="Fora do Padrão"
            value={isLoading ? '—' : kpis.fora}
            icon={XCircle}
          />
        </KPIGrid>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <TableHead key={i}><Skeleton className="h-3 w-16" /></TableHead>
                  ))}
                  <TableHead>Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                    {Array.from({ length: 3 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-12" /></TableCell>
                    ))}
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : filteredRows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Award className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">
              {rows.length === 0
                ? 'Nenhum cliente cadastrado no plano de excelência'
                : 'Nenhum cliente encontrado para o filtro selecionado'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <button
                      className="flex items-center gap-1 hover:text-foreground transition-colors"
                      onClick={() => toggleSort('cliente')}
                    >
                      Cliente
                      <ArrowUpDown className={cn(
                        'h-3 w-3',
                        sortField === 'cliente' ? 'text-foreground' : 'text-muted-foreground/50'
                      )} />
                    </button>
                  </TableHead>
                  {(configs ?? []).map((cfg) => (
                    <TableHead key={cfg.id} className="text-center">
                      <button
                        className="flex items-center gap-1 hover:text-foreground transition-colors mx-auto"
                        onClick={() => toggleSort(cfg.criterio_nome)}
                      >
                        {cfg.criterio_nome}
                        <ArrowUpDown className={cn(
                          'h-3 w-3',
                          sortField === cfg.criterio_nome ? 'text-foreground' : 'text-muted-foreground/50'
                        )} />
                      </button>
                    </TableHead>
                  ))}
                  <TableHead className="text-center">
                    <button
                      className="flex items-center gap-1 hover:text-foreground transition-colors mx-auto"
                      onClick={() => toggleSort('score')}
                    >
                      Score
                      <ArrowUpDown className={cn(
                        'h-3 w-3',
                        sortField === 'score' ? 'text-foreground' : 'text-muted-foreground/50'
                      )} />
                    </button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.map((row) => (
                  <TableRow key={row.cliente_id} className="cursor-pointer">
                    <TableCell>
                      <Link
                        to={`/clientes/${row.cliente_id}`}
                        className="text-foreground hover:text-primary font-medium transition-colors"
                      >
                        {row.cliente_nome}
                      </Link>
                    </TableCell>
                    {row.criterios.map((cel) => (
                      <TableCell
                        key={cel.criterio_nome}
                        className={cn(
                          'text-center font-medium tabular-nums',
                          STATUS_CELL_CLASSES[cel.status]
                        )}
                      >
                        {cel.realizado !== null ? cel.realizado : '—'}
                      </TableCell>
                    ))}
                    <TableCell className="text-center font-bold tabular-nums">
                      {row.score}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
