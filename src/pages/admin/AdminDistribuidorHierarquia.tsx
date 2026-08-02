import { useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ChevronDown, Network, Users } from 'lucide-react'
import { useVendedorHierarchy } from '@/hooks/usePerformanceHierarchy'
import { CarteiraVendedorCard } from '@/components/distribuidor/CarteiraVendedorCard'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { Vendedor } from '@/types/distribuidor'

/**
 * Intent: admin Arruda enxerga a força de campo do distribuidor — quem manda em quem —
 *          e abre cada gerência como uma equipe, não como lista indentada.
 * Palette: navy/foreground para comando; muted para roster; teal só em seleção ativa.
 * Depth: borders-only (tool denso); superfície card para cada equipe.
 * Spacing: escala 4px; gap-3/4 entre células de equipe.
 */

type EquipeGerente = {
  gerente: Vendedor
  supervisores: Array<{
    supervisor: Vendedor
    vendedores: Vendedor[]
  }>
  totalVendedores: number
}

function buildEquipes(gerentes: Vendedor[], todos: Vendedor[]): EquipeGerente[] {
  return gerentes.map((gerente) => {
    const supervisores = todos
      .filter((x) => x.tipo === 'supervisor' && x.supervisor_id === gerente.id)
      .map((supervisor) => ({
        supervisor,
        vendedores: todos.filter(
          (x) => x.tipo === 'vendedor' && x.supervisor_id === supervisor.id
        ),
      }))
    return {
      gerente,
      supervisores,
      totalVendedores: supervisores.reduce((n, s) => n + s.vendedores.length, 0),
    }
  })
}

function RoleMark({ tipo }: { tipo: Vendedor['tipo'] }) {
  const label =
    tipo === 'gerente' ? 'Gerente' : tipo === 'supervisor' ? 'Supervisor' : 'Vendedor'
  return (
    <Badge
      variant={tipo === 'gerente' ? 'default' : tipo === 'supervisor' ? 'secondary' : 'outline'}
      className="text-[11px]"
    >
      {label}
    </Badge>
  )
}

function PersonChip({
  v,
  tone = 'default',
}: {
  v: Vendedor
  tone?: 'default' | 'lead'
}) {
  return (
    <div
      className={cn(
        'min-w-0 rounded-md border px-2.5 py-2',
        tone === 'lead'
          ? 'border-primary/25 bg-primary/5'
          : 'border-border/60 bg-background'
      )}
    >
      <p className="truncate text-xs font-semibold text-foreground">{v.nome}</p>
      <div className="mt-1 flex items-center gap-1.5">
        <RoleMark tipo={v.tipo} />
        {v.codigo_externo && (
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
            {v.codigo_externo}
          </span>
        )}
      </div>
    </div>
  )
}

function GerenteStrip({
  equipes,
  activeId,
  onSelect,
}: {
  equipes: EquipeGerente[]
  activeId: string | 'all'
  onSelect: (id: string | 'all') => void
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      <button
        type="button"
        onClick={() => onSelect('all')}
        className={cn(
          'shrink-0 rounded-md border px-3 py-2 text-left transition-colors',
          activeId === 'all'
            ? 'border-accent/40 bg-accent/10'
            : 'border-border bg-card hover:bg-muted/40'
        )}
      >
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Visão
        </p>
        <p className="text-sm font-semibold text-foreground">Todas as equipes</p>
      </button>
      {equipes.map((eq) => {
        const active = activeId === eq.gerente.id
        return (
          <button
            type="button"
            key={eq.gerente.id}
            onClick={() => onSelect(eq.gerente.id)}
            className={cn(
              'min-w-[10.5rem] shrink-0 rounded-md border px-3 py-2 text-left transition-colors',
              active
                ? 'border-accent/40 bg-accent/10'
                : 'border-border bg-card hover:bg-muted/40'
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <RoleMark tipo="gerente" />
              {eq.gerente.codigo_externo && (
                <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                  {eq.gerente.codigo_externo}
                </span>
              )}
            </div>
            <p className="mt-1.5 line-clamp-2 text-sm font-semibold leading-snug text-foreground">
              {eq.gerente.nome}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground tabular-nums">
              {eq.supervisores.length} sup. · {eq.totalVendedores} vend.
            </p>
          </button>
        )
      })}
    </div>
  )
}

function EquipeBoard({
  equipe,
  defaultOpen,
}: {
  equipe: EquipeGerente
  defaultOpen: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <Card className="overflow-hidden shadow-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 border-b border-border/60 bg-muted/30 px-4 py-3 text-left transition-colors hover:bg-muted/50"
        aria-expanded={open}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-primary/20 bg-primary/10">
          <Users className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-foreground">
              {equipe.gerente.nome}
            </p>
            <RoleMark tipo="gerente" />
            {equipe.gerente.codigo_externo && (
              <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                {equipe.gerente.codigo_externo}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">
            {equipe.supervisores.length} supervisor
            {equipe.supervisores.length === 1 ? '' : 'es'} · {equipe.totalVendedores}{' '}
            vendedor{equipe.totalVendedores === 1 ? '' : 'es'}
          </p>
        </div>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
            open && 'rotate-180'
          )}
        />
      </button>

      {open && (
        <CardContent className="space-y-4 p-4 animate-fade-in">
          {equipe.supervisores.length === 0 ? (
            <p className="rounded-md border border-dashed border-border/70 bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground">
              Nenhum supervisor ligado a este gerente.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
              {equipe.supervisores.map(({ supervisor, vendedores }) => (
                <div
                  key={supervisor.id}
                  className="rounded-lg border border-border/70 bg-muted/15 p-3"
                >
                  <div className="relative mb-3 border-b border-border/50 pb-3 pl-3">
                    <span
                      aria-hidden
                      className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-primary/35"
                    />
                    <PersonChip v={supervisor} tone="lead" />
                    <p className="mt-1.5 text-[11px] text-muted-foreground tabular-nums">
                      {vendedores.length} na equipe
                    </p>
                  </div>

                  {vendedores.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground">Sem vendedores.</p>
                  ) : (
                    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {vendedores.map((v) => (
                        <li key={v.id}>
                          <PersonChip v={v} />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}

export function AdminDistribuidorHierarquia() {
  const { distribuidorId = '' } = useParams<{ distribuidorId: string }>()
  const { data: h, isLoading, isError } = useVendedorHierarchy(distribuidorId || undefined)
  const base = `/parceiros/${distribuidorId}`
  const [focusId, setFocusId] = useState<string | 'all'>('all')

  const equipes = useMemo(() => {
    if (!h) return []
    return buildEquipes(h.gerentes, h.vendedores)
  }, [h])

  const visible = useMemo(() => {
    if (focusId === 'all') return equipes
    return equipes.filter((e) => e.gerente.id === focusId)
  }, [equipes, focusId])

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (isError || !h) {
    return (
      <p className="text-sm text-destructive">
        Não foi possível carregar a hierarquia. Verifique o cadastro de vendedores.
      </p>
    )
  }

  if (equipes.length === 0) {
    return (
      <Card className="shadow-card">
        <CardContent className="p-6 text-center text-xs text-muted-foreground">
          <Network className="mx-auto mb-2 h-8 w-8 opacity-30" />
          Nenhum gerente ativo cadastrado para este distribuidor. Inclua registros via ingestão
          de vendas/cadastro ou em{' '}
          <span className="text-foreground">alwayson_vendedores_distribuidor</span>.
        </CardContent>
      </Card>
    )
  }

  const totalSup = equipes.reduce((n, e) => n + e.supervisores.length, 0)
  const totalVend = equipes.reduce((n, e) => n + e.totalVendedores, 0)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Força de campo
          </p>
          <p className="mt-0.5 text-sm text-foreground">
            <span className="font-semibold tabular-nums">{equipes.length}</span> gerências ·{' '}
            <span className="font-semibold tabular-nums">{totalSup}</span> supervisões ·{' '}
            <span className="font-semibold tabular-nums">{totalVend}</span> vendedores
          </p>
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
            Estrutura ativa. Metas nominais na aba{' '}
            <Link to={`${base}/metas`} className="text-foreground underline-offset-2 hover:underline">
              Metas
            </Link>
            ; SKUs em{' '}
            <Link
              to={`${base}/de-para-produtos`}
              className="text-foreground underline-offset-2 hover:underline"
            >
              Correlação de Produtos
            </Link>
            .
          </p>
        </div>
      </div>

      <GerenteStrip equipes={equipes} activeId={focusId} onSelect={setFocusId} />

      <div className="space-y-4">
        {visible.map((equipe) => (
          <EquipeBoard
            key={`${equipe.gerente.id}:${focusId}`}
            equipe={equipe}
            defaultOpen={focusId !== 'all' || equipes.length <= 3}
          />
        ))}
      </div>

      <CarteiraVendedorCard distribuidorId={distribuidorId} vendedores={h.vendedores} />
    </div>
  )
}
