import { useState } from 'react'
import { Target, Plus, Pencil, Trash2 } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { FilterBar, FilterField } from '@/components/distribuidor/FilterBar'
import { useMetas, useDeleteMeta, type MetaComNomes } from '@/hooks/useMetas'
import { useDistribuidores } from '@/hooks/useDistribuidores'
import { useAuth } from '@/contexts/auth'
import { MetaDialog } from '@/components/distribuidor/MetaDialog'
import { MetasPanorama } from '@/components/distribuidor/MetasPanorama'
import { Button } from '@/components/ui/button'
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
  { value: 'clientes_estrategicos', label: 'Clientes Estratégicos' },
] as const

function AtingimentoCell({ percentual }: { percentual: number | null }) {
  if (percentual === null || percentual === undefined) {
    return <span className="text-muted-foreground">—</span>
  }
  const cn =
    percentual >= 100
      ? 'text-emerald-600'
      : percentual >= 80
        ? 'text-amber-600'
        : 'text-red-600'
  return <span className={cn}>{percentual.toFixed(1)}%</span>
}

/**
 * Diferença entre a meta do nível e a soma das metas dos filhos diretos.
 * Positivo = parcela de venda direta do supervisor/gerente. Negativo = a
 * equipe soma mais do que a meta do nível (rollup estourado).
 */
function RollupCell({ meta }: { meta: MetaComNomes }) {
  if (meta.valor_rollup_filhos === null || meta.hierarquia === 'vendedor') {
    return <span className="text-muted-foreground">—</span>
  }
  const diff = Number(meta.diferenca_rollup ?? 0)
  const filhos = formatCurrency(Number(meta.valor_rollup_filhos))
  return (
    <span className="inline-flex flex-col items-end leading-tight">
      <span className="tabular-nums">{filhos}</span>
      <span
        className={
          diff < 0
            ? 'text-[10px] text-red-600'
            : diff > 0
              ? 'text-[10px] text-muted-foreground'
              : 'text-[10px] text-muted-foreground/60'
        }
      >
        {diff > 0 && `+${formatCurrency(diff)} direta`}
        {diff < 0 && `${formatCurrency(diff)} excedente`}
        {diff === 0 && 'sem venda direta'}
      </span>
    </span>
  )
}

export function AdminMetas() {
  const { distribuidorId: routeDistribuidorId } = useParams<{ distribuidorId?: string }>()
  const scoped = Boolean(routeDistribuidorId)
  const { data: metas, isLoading } = useMetas()
  const { data: distribuidores } = useDistribuidores()
  const { isAdmin } = useAuth()
  const deleteMeta = useDeleteMeta()
  const [distribuidorFilter, setDistribuidorFilter] = useState<string>('todos')
  const [hierarquiaFilter, setHierarquiaFilter] = useState<string>('todos')
  const [tipoFilter, setTipoFilter] = useState<string>('todos')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [metaEmEdicao, setMetaEmEdicao] = useState<MetaComNomes | null>(null)

  const effectiveDistFilter = scoped ? routeDistribuidorId! : distribuidorFilter

  /** Distribuidor alvo do dialog: da rota, do filtro, ou o único cadastrado. */
  const distribuidorAlvo =
    routeDistribuidorId ??
    (distribuidorFilter !== 'todos' ? distribuidorFilter : undefined) ??
    (distribuidores?.length === 1 ? distribuidores[0].id : undefined)

  function abrirNova() {
    setMetaEmEdicao(null)
    setDialogOpen(true)
  }

  function abrirEdicao(m: MetaComNomes) {
    setMetaEmEdicao(m)
    setDialogOpen(true)
  }

  const filtered = (metas ?? []).filter((m) => {
    const matchDist =
      effectiveDistFilter === 'todos' || m.distribuidor_id === effectiveDistFilter
    const matchHier =
      hierarquiaFilter === 'todos' || m.hierarquia === hierarquiaFilter
    const matchTipo = tipoFilter === 'todos' || m.tipo === tipoFilter
    return matchDist && matchHier && matchTipo
  })

  return (
    <div>
      {!scoped && (
        <div className="mb-6">
          <MetasPanorama distribuidorId={distribuidorAlvo} />
        </div>
      )}

      <div className="flex justify-end mb-4">
        <Button
          onClick={abrirNova}
          disabled={!isAdmin || !distribuidorAlvo}
          title={
            !isAdmin
              ? 'Apenas administradores podem definir metas.'
              : !distribuidorAlvo
                ? 'Selecione um distribuidor para criar a meta.'
                : undefined
          }
          className="h-9 text-sm"
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Nova meta
        </Button>
      </div>

      <FilterBar>
        {!scoped && (
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
        )}
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
              {!scoped && <TableHead>Distribuidor</TableHead>}
              <TableHead>Responsável</TableHead>
              <TableHead>Hierarquia</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Período</TableHead>
              <TableHead className="text-right">Meta</TableHead>
              <TableHead className="text-right">Soma da equipe</TableHead>
              <TableHead className="text-right">Realizado</TableHead>
              <TableHead className="text-right">Atingimento</TableHead>
              <TableHead className="text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: scoped ? 9 : 10 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={scoped ? 9 : 10} className="py-8 text-center">
                  <Target className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">
                    Nenhuma meta encontrada
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((m) => (
                <TableRow key={m.id}>
                  {!scoped && (
                    <TableCell className="text-xs font-medium">
                      {m.distribuidor_nome}
                    </TableCell>
                  )}
                  <TableCell className="text-xs text-muted-foreground">
                    {m.vendedor_nome ?? '—'}
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
                  <TableCell className="text-xs text-right">
                    <RollupCell meta={m} />
                  </TableCell>
                  <TableCell className="text-xs tabular-nums text-right">
                    {m.valor_realizado === null ? '—' : formatCurrency(Number(m.valor_realizado))}
                  </TableCell>
                  <TableCell className="text-xs tabular-nums text-right">
                    <AtingimentoCell percentual={m.percentual_atingimento} />
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2"
                      disabled={!isAdmin}
                      onClick={() => abrirEdicao(m)}
                    >
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-muted-foreground hover:text-destructive"
                      disabled={!isAdmin || deleteMeta.isPending}
                      onClick={() => {
                        if (confirm('Excluir esta meta?')) deleteMeta.mutate(m.id)
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {scoped && (
        <div className="mt-6">
          <MetasPanorama distribuidorId={distribuidorAlvo} />
        </div>
      )}

      {/* Montado só quando aberto: o formulário inicializa a partir dos props,
          sem efeito de sincronização. */}
      {dialogOpen && (
        <MetaDialog
          open
          onOpenChange={setDialogOpen}
          distribuidorId={metaEmEdicao?.distribuidor_id ?? distribuidorAlvo}
          meta={metaEmEdicao}
        />
      )}
    </div>
  )
}
