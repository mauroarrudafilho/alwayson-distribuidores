import { useEffect, useMemo, useState } from 'react'
import { Target, Plus, Pencil, Trash2 } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { PageHeader } from '@/components/distribuidor/PageHeader'
import { FilterBar, FilterField } from '@/components/distribuidor/FilterBar'
import { useMetas, useDeleteMeta, type MetaComNomes } from '@/hooks/useMetas'
import { useDistribuidores } from '@/hooks/useDistribuidores'
import { useAuth } from '@/contexts/auth'
import { MetaDialog } from '@/components/distribuidor/MetaDialog'
import { MetaCadastroFlow } from '@/components/distribuidor/MetaCadastroFlow'
import { MetasPanorama } from '@/components/distribuidor/MetasPanorama'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatCurrency, formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'

const DEMO_MES = '2026-05'

type MetasTab = 'acompanhamento' | 'cadastro'

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
  const color =
    percentual >= 100
      ? 'text-emerald-600'
      : percentual >= 80
        ? 'text-amber-600'
        : 'text-red-600'
  return <span className={color}>{percentual.toFixed(1)}%</span>
}

function ResumoMetas({ metas }: { metas: MetaComNomes[] }) {
  const comPct = metas.filter((m) => m.percentual_atingimento !== null)
  const media =
    comPct.length > 0
      ? comPct.reduce((s, m) => s + Number(m.percentual_atingimento), 0) / comPct.length
      : null
  const bateu = comPct.filter((m) => Number(m.percentual_atingimento) >= 100).length

  return (
    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
      <span>
        <strong className="text-foreground">{metas.length}</strong> meta(s)
      </span>
      {comPct.length > 0 && (
        <>
          <span>
            <strong className="text-emerald-700 dark:text-emerald-400">{bateu}</strong> atingiram
          </span>
          <span>
            Média simples:{' '}
            <strong className="text-foreground tabular-nums">{media!.toFixed(1)}%</strong>
          </span>
        </>
      )}
    </div>
  )
}

function DistribuidorFilter({
  value,
  onChange,
  distribuidores,
  distribuidorNome,
}: {
  value: string
  onChange: (v: string) => void
  distribuidores: { id: string; nome: string }[]
  distribuidorNome: string | null
}) {
  return (
    <FilterField label="Distribuidor" className="min-w-0 max-w-md">
      <Select value={value} onValueChange={(v) => onChange(v ?? 'todos')}>
        <SelectTrigger
          className="h-8 w-full min-w-0 text-sm"
          title={value !== 'todos' ? (distribuidorNome ?? undefined) : undefined}
        >
          <span className="truncate">
            {value === 'todos' ? 'Todos' : (distribuidorNome ?? 'Distribuidor')}
          </span>
        </SelectTrigger>
        <SelectContent
          align="start"
          alignItemWithTrigger={false}
          className="w-max min-w-[var(--anchor-width)] max-w-[min(28rem,calc(100vw-2rem))]"
        >
          <SelectItem value="todos">Todos</SelectItem>
          {distribuidores.map((d) => (
            <SelectItem key={d.id} value={d.id}>
              <span className="whitespace-normal leading-snug">{d.nome}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FilterField>
  )
}

export function AdminMetas() {
  const { distribuidorId: routeDistribuidorId } = useParams<{ distribuidorId?: string }>()
  const scoped = Boolean(routeDistribuidorId)
  const { data: metas, isLoading } = useMetas()
  const { data: distribuidores } = useDistribuidores()
  const { isAdmin } = useAuth()
  const deleteMeta = useDeleteMeta()
  const [tab, setTab] = useState<MetasTab>('acompanhamento')
  const [distribuidorFilter, setDistribuidorFilter] = useState<string>('todos')
  const [hierarquiaFilter, setHierarquiaFilter] = useState<string>('distribuidor')
  const [tipoFilter, setTipoFilter] = useState<string>('faturamento')
  const [mesFilter, setMesFilter] = useState(DEMO_MES)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [flowOpen, setFlowOpen] = useState(false)
  const [metaEmEdicao, setMetaEmEdicao] = useState<MetaComNomes | null>(null)

  useEffect(() => {
    if (scoped || !distribuidores?.length) return
    if (distribuidorFilter === 'todos') {
      setDistribuidorFilter(distribuidores[0].id)
    }
  }, [scoped, distribuidores, distribuidorFilter])

  const effectiveDistFilter = scoped ? routeDistribuidorId! : distribuidorFilter

  const distribuidorAlvo =
    routeDistribuidorId ??
    (distribuidorFilter !== 'todos' ? distribuidorFilter : undefined) ??
    (distribuidores?.length === 1 ? distribuidores[0].id : undefined)

  const distribuidorNome =
    scoped || distribuidorFilter === 'todos'
      ? null
      : (distribuidores ?? []).find((d) => d.id === distribuidorFilter)?.nome ?? null

  function abrirFluxo() {
    setFlowOpen(true)
  }

  function abrirEdicao(m: MetaComNomes) {
    setMetaEmEdicao(m)
    setDialogOpen(true)
  }

  const filtered = useMemo(() => {
    return (metas ?? []).filter((m) => {
      const matchDist =
        effectiveDistFilter === 'todos' || m.distribuidor_id === effectiveDistFilter
      const matchHier =
        hierarquiaFilter === 'todos' || m.hierarquia === hierarquiaFilter
      const matchTipo = tipoFilter === 'todos' || m.tipo === tipoFilter
      const matchMes =
        !mesFilter || m.periodo_inicio.slice(0, 7) === mesFilter
      return matchDist && matchHier && matchTipo && matchMes
    })
  }, [metas, effectiveDistFilter, hierarquiaFilter, tipoFilter, mesFilter])

  return (
    <div className="space-y-4 animate-fade-in">
      {!scoped && (
        <PageHeader
          title="Metas"
          accent=" e acompanhamento"
          description="monitore a evolução mensal das equipes e cadastre metas por vendedor e período"
        />
      )}

      {!scoped && (
        <FilterBar gridClassName="grid-cols-1 lg:max-w-md">
          <DistribuidorFilter
            value={distribuidorFilter}
            onChange={setDistribuidorFilter}
            distribuidores={distribuidores ?? []}
            distribuidorNome={distribuidorNome}
          />
        </FilterBar>
      )}

      <Tabs value={tab} onValueChange={(v) => setTab(v as MetasTab)}>
        <TabsList
          variant="line"
          className="tab-strip mb-2 h-auto gap-1 border-0 border-b border-border/50 bg-transparent p-0"
        >
          <TabsTrigger
            value="acompanhamento"
            className="rounded-none border-b-2 border-transparent px-2 py-2 text-xs whitespace-nowrap text-muted-foreground data-active:border-teal data-active:font-semibold data-active:text-foreground sm:px-3 sm:text-[13px]"
          >
            Acompanhamento
          </TabsTrigger>
          <TabsTrigger
            value="cadastro"
            className="rounded-none border-b-2 border-transparent px-2 py-2 text-xs whitespace-nowrap text-muted-foreground data-active:border-teal data-active:font-semibold data-active:text-foreground sm:px-3 sm:text-[13px]"
          >
            Cadastro
          </TabsTrigger>
        </TabsList>

        <TabsContent value="acompanhamento" className="mt-3">
          <MetasPanorama distribuidorId={distribuidorAlvo} mesReferencia={mesFilter || DEMO_MES} />
        </TabsContent>

        <TabsContent value="cadastro" className="mt-3">
          <Card className="overflow-hidden">
            <div className="border-b border-border/60 bg-muted/20 px-3 py-2.5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div
                  className={cn(
                    'grid flex-1 gap-3',
                    scoped ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-3'
                  )}
                >
                  <FilterField label="Mês">
                    <Input
                      type="month"
                      value={mesFilter}
                      onChange={(e) => setMesFilter(e.target.value)}
                      className="h-8 w-full min-w-[8.5rem] text-sm"
                    />
                  </FilterField>
                  <FilterField label="Hierarquia">
                    <Select
                      value={hierarquiaFilter}
                      onValueChange={(v) => setHierarquiaFilter(v ?? 'todos')}
                    >
                      <SelectTrigger className="h-8 w-full text-sm">
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
                    <Select value={tipoFilter} onValueChange={(v) => setTipoFilter(v ?? 'todos')}>
                      <SelectTrigger className="h-8 w-full text-sm">
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
                </div>

                <Button
                  onClick={abrirFluxo}
                  disabled={!isAdmin || !distribuidorAlvo}
                  title={
                    !isAdmin
                      ? 'Apenas administradores podem definir metas.'
                      : !distribuidorAlvo
                        ? 'Selecione um distribuidor para criar a meta.'
                        : undefined
                  }
                  className="h-8 shrink-0 text-xs"
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Definir metas
                </Button>
              </div>

              {!isLoading && filtered.length > 0 && (
                <div className="mt-2.5 border-t border-border/40 pt-2.5">
                  <ResumoMetas metas={filtered} />
                </div>
              )}
            </div>

            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {!scoped && <TableHead>Distribuidor</TableHead>}
                  <TableHead>Responsável</TableHead>
                  <TableHead>Hierarquia</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead className="text-right">Meta</TableHead>
                  <TableHead className="text-right">Realizado</TableHead>
                  <TableHead className="text-right">Atingimento</TableHead>
                  <TableHead className="text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: scoped ? 8 : 9 }).map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-24" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={scoped ? 8 : 9} className="py-10 text-center">
                      <Target className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
                      <p className="text-xs text-muted-foreground">Nenhuma meta neste recorte</p>
                      {mesFilter === DEMO_MES && (
                        <p className="mt-1 text-[11px] text-muted-foreground/80">
                          Para demo: rode{' '}
                          <code className="text-foreground">npm run metas:seed-demo-maio</code>
                        </p>
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((m) => (
                    <TableRow key={m.id}>
                      {!scoped && (
                        <TableCell className="max-w-[180px] truncate text-xs font-medium">
                          {m.distribuidor_nome}
                        </TableCell>
                      )}
                      <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                        {m.responsavel_nome}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[10px]">
                          {m.hierarquia}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs capitalize text-muted-foreground">
                        {m.tipo}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatDate(m.periodo_inicio)} – {formatDate(m.periodo_fim)}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        {formatCurrency(m.valor_meta)}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        {m.valor_realizado === null
                          ? '—'
                          : formatCurrency(Number(m.valor_realizado))}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        <AtingimentoCell percentual={m.percentual_atingimento} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2"
                          disabled={!isAdmin}
                          onClick={() => abrirEdicao(m)}
                        >
                          <Pencil className="h-3 w-3" />
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
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {flowOpen && (
        <MetaCadastroFlow
          open
          onOpenChange={setFlowOpen}
          distribuidorId={distribuidorAlvo}
          mesDefault={mesFilter || DEMO_MES}
        />
      )}

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
