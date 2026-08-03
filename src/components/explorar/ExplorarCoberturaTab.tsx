import { useMemo, useState } from 'react'
import { ChevronDown, MapPin, PieChart } from 'lucide-react'
import { Panel } from '@/components/distribuidor/Panel'
import { EmptyState } from '@/components/distribuidor/EmptyState'
import { ExplorarCoberturaBairroDrawer } from '@/components/explorar/ExplorarCoberturaBairroDrawer'
import { InsightsSearchField } from '@/components/insights/InsightsSearchField'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { PaginationBar } from '@/components/ui/pagination-bar'
import { usePagination } from '@/hooks/usePagination'
import { formatExplorarRank } from '@/lib/pdv'
import type { PdvCoberturaRow } from '@/types/pdv'
import { cn } from '@/lib/utils'

type Props = {
  rows: PdvCoberturaRow[] | undefined
  isLoading: boolean
  isError: boolean
  distribuidorId: string | undefined
  fornecedorId: string | undefined
  codigoIbge: number | null | undefined
}

function coberturaTone(pct: number | null): string {
  if (pct == null) return 'text-muted-foreground'
  if (pct >= 50) return 'text-emerald-700'
  if (pct >= 20) return 'text-amber-700'
  return 'text-orange-700'
}

function matchesCoberturaSearch(row: PdvCoberturaRow, q: string): boolean {
  const n = q.trim().toLowerCase()
  if (!n) return true
  const hay = [
    row.bairro,
    row.municipio,
    row.uf,
    row.cnae_grupo,
    String(row.qtd_qualificados),
    String(row.qtd_atendidos),
    row.percentual_cobertura?.toFixed(1) ?? '',
    String(Math.round(row.potencial_nao_atendido ?? 0)),
  ]
    .join(' ')
    .toLowerCase()
  return hay.includes(n)
}

export function ExplorarCoberturaTab({
  rows,
  isLoading,
  isError,
  distribuidorId,
  fornecedorId,
  codigoIbge,
}: Props) {
  const [gruposSelecionados, setGruposSelecionados] = useState<Set<string>>(() => new Set())
  const [search, setSearch] = useState('')
  const [grupoAberto, setGrupoAberto] = useState<PdvCoberturaRow | null>(null)

  const gruposCnae = useMemo(() => {
    const set = new Set<string>()
    for (const r of rows ?? []) set.add(r.cnae_grupo)
    return [...set].sort()
  }, [rows])

  const todosGruposAtivos =
    gruposSelecionados.size === 0 || gruposSelecionados.size === gruposCnae.length

  const labelGrupos = useMemo(() => {
    if (todosGruposAtivos || gruposCnae.length === 0) return 'Todos os grupos'
    if (gruposSelecionados.size === 1) return [...gruposSelecionados][0]
    return `${gruposSelecionados.size} grupos`
  }, [todosGruposAtivos, gruposSelecionados, gruposCnae.length])

  const toggleGrupoCnae = (grupo: string, checked: boolean) => {
    setGruposSelecionados((prev) => {
      const all = new Set(gruposCnae)
      const base = prev.size === 0 ? all : new Set(prev)

      if (checked) {
        base.add(grupo)
        if (base.size >= gruposCnae.length) return new Set()
        return base
      }

      if (prev.size === 0) {
        all.delete(grupo)
        return all
      }

      base.delete(grupo)
      if (base.size === 0) return new Set()
      return base
    })
  }

  const selecionarTodosGrupos = () => setGruposSelecionados(new Set())

  const filtered = useMemo(() => {
    let list = rows ?? []
    if (!todosGruposAtivos) {
      list = list.filter((r) => gruposSelecionados.has(r.cnae_grupo))
    }
    list = list.filter((r) => r.qtd_qualificados > 0)
    if (search.trim()) list = list.filter((r) => matchesCoberturaSearch(r, search))
    return [...list].sort(
      (a, b) => (Number(b.potencial_nao_atendido) || 0) - (Number(a.potencial_nao_atendido) || 0)
    )
  }, [rows, todosGruposAtivos, gruposSelecionados, search])

  const pag = usePagination({
    items: filtered,
    initialPageSize: 25,
    resetKey: `${labelGrupos}-${search}`,
  })

  const mediaCobertura = useMemo(() => {
    const list = rows ?? []
    const totalQ = list.reduce((s, r) => s + r.qtd_qualificados, 0)
    const totalA = list.reduce((s, r) => s + r.qtd_atendidos, 0)
    return totalQ > 0 ? (totalA / totalQ) * 100 : null
  }, [rows])

  if (isLoading) {
    return <Skeleton className="h-64 w-full rounded-lg" />
  }

  if (isError) {
    return (
      <EmptyState
        icon={PieChart}
        title="Erro ao carregar cobertura"
        description="Não foi possível ler os agregados por bairro e CNAE."
      />
    )
  }

  if (!rows?.length) {
    return (
      <EmptyState
        icon={PieChart}
        title="Sem dados de cobertura"
        description="Execute a etapa de cobertura do pipeline PDV para esta cidade."
      />
    )
  }

  return (
    <>
      <Panel accent className="overflow-hidden p-0">
        <div className="border-b border-border/50 px-4 py-3 space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="font-display text-base font-normal text-foreground">
                Cobertura por microrregião
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                PDVs qualificados vs carteira · média geral{' '}
                <span className={cn('font-medium tabular-nums', coberturaTone(mediaCobertura))}>
                  {mediaCobertura != null ? `${mediaCobertura.toFixed(1)}%` : '—'}
                </span>
                {' · '}
                clique no bairro para mapa + lista · ordenado por índice aberto
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger
                type="button"
                className={cn(
                  'inline-flex h-8 w-[220px] items-center justify-between gap-2 rounded-md border border-input bg-background px-2.5 text-xs font-normal shadow-xs hover:bg-muted/40'
                )}
              >
                <span className="truncate">{labelGrupos}</span>
                <ChevronDown className="size-3.5 shrink-0 opacity-50" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[220px]">
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                  Grupo CNAE
                </DropdownMenuLabel>
                <DropdownMenuCheckboxItem
                  checked={todosGruposAtivos}
                  onCheckedChange={(checked) => {
                    if (checked) selecionarTodosGrupos()
                  }}
                  onClick={(e) => e.preventDefault()}
                >
                  Todos os grupos
                </DropdownMenuCheckboxItem>
                <DropdownMenuSeparator />
                {gruposCnae.map((g) => (
                  <DropdownMenuCheckboxItem
                    key={g}
                    checked={todosGruposAtivos || gruposSelecionados.has(g)}
                    onCheckedChange={(checked) => toggleGrupoCnae(g, checked === true)}
                    onClick={(e) => e.preventDefault()}
                  >
                    {g}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <InsightsSearchField
            value={search}
            onChange={setSearch}
            placeholder="Buscar bairro, CNAE, cobertura…"
          />
        </div>

        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10">#</TableHead>
              <TableHead>Bairro</TableHead>
              <TableHead>Grupo CNAE</TableHead>
              <TableHead className="text-right">Qualificados</TableHead>
              <TableHead className="text-right">Atendidos</TableHead>
              <TableHead className="text-right">Cobertura</TableHead>
              <TableHead className="text-right">Índice não atendido</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pag.paginated.map((r, i) => {
              const rank = (pag.page - 1) * pag.pageSize + i + 1
              return (
              <TableRow
                key={r.id}
                className="cursor-pointer hover:bg-muted/40"
                onClick={() => setGrupoAberto(r)}
              >
                <TableCell className="font-mono text-xs tabular-nums text-muted-foreground">
                  {formatExplorarRank(rank)}
                </TableCell>
                <TableCell>
                  <div className="flex items-start gap-2">
                    <MapPin className="mt-0.5 size-3.5 shrink-0 text-teal/70" aria-hidden />
                    <div>
                      <div className="text-sm font-medium text-navy">{r.bairro}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {r.municipio} / {r.uf}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-sm">{r.cnae_grupo}</TableCell>
                <TableCell className="text-right tabular-nums">{r.qtd_qualificados}</TableCell>
                <TableCell className="text-right tabular-nums">{r.qtd_atendidos}</TableCell>
                <TableCell
                  className={cn(
                    'text-right tabular-nums font-medium',
                    coberturaTone(r.percentual_cobertura)
                  )}
                >
                  {r.percentual_cobertura != null ? `${r.percentual_cobertura.toFixed(1)}%` : '—'}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {Math.round(r.potencial_nao_atendido ?? 0).toLocaleString('pt-BR')}
                </TableCell>
              </TableRow>
              )
            })}
          </TableBody>
        </Table>

        {pag.total === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhum grupo com os filtros atuais.
          </p>
        ) : (
          <PaginationBar
            page={pag.page}
            pageSize={pag.pageSize}
            total={pag.total}
            onPageChange={pag.setPage}
            onPageSizeChange={pag.setPageSize}
            pageSizeOptions={[25, 50, 100]}
          />
        )}
      </Panel>

      <ExplorarCoberturaBairroDrawer
        grupo={grupoAberto}
        onClose={() => setGrupoAberto(null)}
        distribuidorId={distribuidorId}
        fornecedorId={fornecedorId}
        codigoIbge={codigoIbge}
      />
    </>
  )
}
