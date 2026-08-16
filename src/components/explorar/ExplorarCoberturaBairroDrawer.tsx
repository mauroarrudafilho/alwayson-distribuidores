import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, EyeOff, Loader2, MapPin, Users } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { InsightsSearchField } from '@/components/insights/InsightsSearchField'
import { Skeleton } from '@/components/ui/skeleton'
import { useExplorarCoberturaDetalhe } from '@/hooks/useExplorar'
import { useDesconsiderarPdv } from '@/hooks/usePdvDesconsiderados'
import { formatCnpj } from '@/lib/format'
import {
  faixaRelevanciaLabel,
  formatExplorarRank,
  formatIndiceRelevancia,
} from '@/lib/pdv'
import type { PdvCoberturaRow } from '@/types/pdv'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const ExplorarCoberturaDetalheMap = lazy(() =>
  import('@/components/explorar/ExplorarCoberturaDetalheMap').then((m) => ({
    default: m.ExplorarCoberturaDetalheMap,
  }))
)

type Props = {
  grupo: PdvCoberturaRow | null
  onClose: () => void
  distribuidorId: string | undefined
  fornecedorId: string | undefined
  codigoIbge: number | null | undefined
}

type StatusFiltro = 'todos' | 'nao_atendido' | 'carteira'

function matchesDetalheSearch(
  q: string,
  row: { nome: string; cnpj: string; segmento_cnae: string; faixa: string | null }
): boolean {
  const n = q.trim().toLowerCase()
  if (!n) return true
  const hay = [row.nome, row.cnpj, row.segmento_cnae, row.faixa ?? ''].join(' ').toLowerCase()
  return hay.includes(n)
}

export function ExplorarCoberturaBairroDrawer({
  grupo,
  onClose,
  distribuidorId,
  fornecedorId,
  codigoIbge,
}: Props) {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFiltro>('todos')
  const [selectedCnpj, setSelectedCnpj] = useState<string | null>(null)
  const itemRefs = useRef(new Map<string, HTMLLIElement>())
  const desconsiderar = useDesconsiderarPdv()

  const detalheQ = useExplorarCoberturaDetalhe(
    distribuidorId,
    fornecedorId,
    codigoIbge,
    grupo
  )

  const filtered = useMemo(() => {
    let list = detalheQ.data ?? []
    if (status === 'carteira') list = list.filter((r) => r.atendido)
    if (status === 'nao_atendido') list = list.filter((r) => !r.atendido)
    if (search.trim()) {
      list = list.filter((r) => matchesDetalheSearch(search, r))
    }
    return list
  }, [detalheQ.data, status, search])

  const comGeo = useMemo(
    () => filtered.filter((p) => p.geo_mapa),
    [filtered]
  )

  const open = grupo != null

  useEffect(() => {
    if (!selectedCnpj) return
    const el = itemRefs.current.get(selectedCnpj)
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selectedCnpj])

  const handleSelect = (cnpj: string) => {
    setSelectedCnpj((prev) => (prev === cnpj ? null : cnpj))
  }

  const handleDesconsiderar = (cnpj: string) => {
    desconsiderar.mutate(
      { cnpj, motivo: 'fora_do_mix' },
      {
        onSuccess: () => {
          if (selectedCnpj === cnpj) setSelectedCnpj(null)
        },
      }
    )
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      onClose()
      setSearch('')
      setStatus('todos')
      setSelectedCnpj(null)
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className="flex h-full w-full max-w-none flex-col gap-0 p-0 data-[side=right]:sm:max-w-6xl"
      >
        <SheetHeader className="shrink-0 border-b border-border/50 px-4 py-3 pr-12">
          <SheetTitle className="flex min-w-0 items-center gap-2 font-display text-base font-normal">
            <MapPin className="size-4 shrink-0 text-teal" />
            <span className="truncate">{grupo?.bairro ?? 'Bairro'}</span>
          </SheetTitle>
          <SheetDescription className="text-xs">
            {grupo?.cnae_grupo} · {grupo?.municipio} / {grupo?.uf}
            {grupo ? (
              <>
                {' · '}
                <span className="tabular-nums">
                  {grupo.qtd_qualificados} qualificados · {grupo.qtd_atendidos} na carteira ·{' '}
                  {grupo.percentual_cobertura != null
                    ? `${grupo.percentual_cobertura.toFixed(1)}% cobertura`
                    : '—'}
                </span>
              </>
            ) : null}
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <div className="relative min-h-[220px] shrink-0 border-b border-border/50 lg:min-h-0 lg:w-[58%] lg:border-b-0 lg:border-r">
            {detalheQ.isLoading ? (
              <Skeleton className="h-full min-h-[220px] w-full rounded-none" />
            ) : (
              <Suspense
                fallback={
                  <div className="flex h-full min-h-[220px] items-center justify-center text-muted-foreground">
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Mapa…
                  </div>
                }
              >
                <ExplorarCoberturaDetalheMap
                  pontos={filtered}
                  selectedCnpj={selectedCnpj}
                  onSelect={handleSelect}
                  className="h-full min-h-[220px] lg:absolute lg:inset-0"
                />
              </Suspense>
            )}
            {!detalheQ.isLoading && comGeo.length > 0 && (
              <p className="pointer-events-none absolute bottom-2 left-2 rounded-md bg-background/90 px-2 py-1 text-[10px] text-muted-foreground shadow-sm ring-1 ring-border/50">
                {comGeo.length} no mapa
                {filtered.length > comGeo.length
                  ? ` · ${filtered.length - comGeo.length} sem geocode`
                  : ''}
              </p>
            )}
          </div>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:w-[42%]">
            <div className="shrink-0 space-y-3 border-b border-border/50 px-4 py-3">
              <InsightsSearchField
                value={search}
                onChange={setSearch}
                placeholder="Buscar PDV, CNPJ ou faixa…"
              />
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ['todos', 'Todos'],
                    ['nao_atendido', 'Não atendidos'],
                    ['carteira', 'Na carteira'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setStatus(id)}
                    className={cn(
                      'rounded-full border px-2.5 py-0.5 text-[11px] transition-colors',
                      status === id
                        ? 'border-navy/40 bg-navy text-white'
                        : 'border-border/70 bg-background text-muted-foreground hover:border-border'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Users className="size-3" />
                {filtered.length.toLocaleString('pt-BR')} PDVs · clique na lista ou no mapa
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {detalheQ.isLoading ? (
                <div className="p-4">
                  <Skeleton className="h-32 w-full" />
                </div>
              ) : detalheQ.isError ? (
                <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                  Não foi possível carregar os PDVs deste recorte.
                </p>
              ) : filtered.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                  Nenhum PDV com os filtros atuais.
                </p>
              ) : (
                <ul className="divide-y divide-border/40">
                  {filtered.map((r, i) => {
                    const selected = r.cnpj === selectedCnpj
                    const dimmed = selectedCnpj != null && !selected
                    return (
                      <li
                        key={r.cnpj}
                        ref={(el) => {
                          if (el) itemRefs.current.set(r.cnpj, el)
                          else itemRefs.current.delete(r.cnpj)
                        }}
                      >
                        <div
                          className={cn(
                            'flex w-full items-start gap-2 border-l-2 px-4 py-3 text-left transition-all',
                            selected
                              ? 'border-l-teal bg-teal/10 ring-1 ring-inset ring-teal/25'
                              : 'border-l-transparent hover:bg-muted/40',
                            dimmed && 'opacity-50'
                          )}
                        >
                          <button
                            type="button"
                            className="min-w-0 flex-1 text-left"
                            onClick={() => handleSelect(r.cnpj)}
                          >
                            <div className="flex items-start gap-2">
                              <span
                                className={cn(
                                  'mt-0.5 font-mono text-[10px] tabular-nums',
                                  selected ? 'font-semibold text-teal' : 'text-muted-foreground'
                                )}
                              >
                                {formatExplorarRank(i + 1)}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                                  <span className="truncate">{r.nome}</span>
                                  {r.atendido && (
                                    <Badge
                                      variant="outline"
                                      className="border-teal/40 bg-teal/10 px-1.5 py-0 text-[10px] font-normal text-teal"
                                    >
                                      Carteira
                                    </Badge>
                                  )}
                                </p>
                                <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                                  {formatCnpj(r.cnpj)}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {r.faixa ? faixaRelevanciaLabel(r.faixa) : '—'}
                                  <span className="mx-1 opacity-40">·</span>
                                  {formatIndiceRelevancia(r.indice_relevancia)}
                                  <span className="mx-1 opacity-40">·</span>
                                  {r.segmento_cnae}
                                  {!r.geo_mapa && (
                                    <>
                                      <span className="mx-1 opacity-40">·</span>
                                      <span className="text-warning">sem mapa</span>
                                    </>
                                  )}
                                </p>
                              </div>
                            </div>
                          </button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="mt-0.5 size-8 shrink-0 text-muted-foreground hover:text-destructive"
                            title="Não se aplica ao nosso negócio"
                            disabled={desconsiderar.isPending}
                            onClick={() => handleDesconsiderar(r.cnpj)}
                          >
                            <EyeOff className="size-4" />
                          </Button>
                          {r.cliente_id && (
                            <Link
                              to={`/clientes/${r.cliente_id}`}
                              className="mt-1 inline-flex shrink-0 text-muted-foreground hover:text-foreground"
                              aria-label="Ver ficha na carteira"
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Link>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
