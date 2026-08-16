import { useEffect, useMemo, useState } from 'react'
import { ArrowUpDown, ChevronRight, TrendingUp, Trophy } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FilterField } from '@/components/distribuidor/FilterBar'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useMetasPanorama } from '@/hooks/useMetas'
import { useVendedorHierarchy } from '@/hooks/usePerformanceHierarchy'
import { formatCurrency } from '@/lib/format'
import { getCurrentMonth } from '@/lib/periodo'
import type { Meta } from '@/types/distribuidor'
import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface CelulaMes {
  meta: number
  realizado: number | null
  pct: number | null
}

type SortDir = 'asc' | 'desc'
/** `meta` = meta do mês vigente; `acum` ou YYYY-MM = coluna de atingimento */
type SortField = 'meta' | 'acum' | string

interface LinhaPanorama {
  id: string
  nome: string
  celulas: Map<string, CelulaMes>
  metaReferencia: number
  acumulado: number | null
  acumuladoMeta: number
  acumuladoRealizado: number | null
}

interface CelulaBadge {
  label: string
  variant: 'accent' | 'info' | 'success' | 'warning'
  title: string
}

function formatValorMetrica(valor: number, tipo: Meta['tipo']): string {
  if (tipo === 'faturamento') return formatCurrency(valor)
  return valor.toLocaleString('pt-BR')
}

function DetalheAtingimento({
  meta,
  realizado,
  pct,
  tipo,
}: {
  meta: number
  realizado: number | null
  pct: number | null
  tipo: Meta['tipo']
}) {
  return (
    <div className="space-y-0.5 text-xs">
      <p>
        <span className="text-muted-foreground">Meta: </span>
        <span className="font-medium tabular-nums">{formatValorMetrica(meta, tipo)}</span>
      </p>
      <p>
        <span className="text-muted-foreground">Realizado: </span>
        <span className="font-medium tabular-nums">
          {realizado === null ? '—' : formatValorMetrica(realizado, tipo)}
        </span>
      </p>
      {pct !== null && (
        <p className="text-[10px] text-muted-foreground tabular-nums">{pct.toFixed(1)}% de atingimento</p>
      )}
    </div>
  )
}

function CelulaAtingimento({
  celula,
  tipo,
  className,
  destaque,
  badges = [],
}: {
  celula: CelulaMes | undefined
  tipo: Meta['tipo']
  className?: string
  destaque?: boolean
  badges?: CelulaBadge[]
}) {
  if (!celula) return <td className={className} />
  if (celula.pct === null) {
    return (
      <td className={cn(className, 'text-muted-foreground')}>
        <Tooltip>
          <TooltipTrigger
            type="button"
            className="cursor-help p-0"
            onClick={(e) => e.stopPropagation()}
          >
            —
          </TooltipTrigger>
          <TooltipContent side="top" className="px-3 py-2">
            <DetalheAtingimento meta={celula.meta} realizado={celula.realizado} pct={null} tipo={tipo} />
          </TooltipContent>
        </Tooltip>
      </td>
    )
  }

  return (
    <td className={cn(className, corAtingimento(celula.pct), destaque && 'font-medium')}>
      <div className="inline-flex flex-col items-end gap-0.5">
        <Tooltip>
          <TooltipTrigger
            type="button"
            className="cursor-help p-0 tabular-nums underline decoration-dotted underline-offset-2"
            onClick={(e) => e.stopPropagation()}
          >
            {celula.pct.toFixed(0)}%
          </TooltipTrigger>
          <TooltipContent side="top" className="px-3 py-2">
            <DetalheAtingimento
              meta={celula.meta}
              realizado={celula.realizado}
              pct={celula.pct}
              tipo={tipo}
            />
          </TooltipContent>
        </Tooltip>
        {badges.length > 0 && (
          <div className="flex flex-wrap justify-end gap-0.5">
            {badges.map((b) => (
              <Badge
                key={b.label}
                variant={b.variant}
                title={b.title}
                className="h-4 px-1 text-[9px] font-medium"
              >
                {b.label === 'Top' && <Trophy className="size-2.5" />}
                {b.label === '↑' && <TrendingUp className="size-2.5" />}
                {b.label}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </td>
  )
}

/** Meta cadastrada para um mês específico (ex.: mês vigente). */
function metaDoMes(l: { celulas: Map<string, CelulaMes> }, mes: string): number {
  return l.celulas.get(mes)?.meta ?? 0
}

function valorOrdenacao(l: LinhaPanorama, field: SortField): number | null {
  if (field === 'meta') return l.metaReferencia > 0 ? l.metaReferencia : null
  if (field === 'acum') return l.acumulado
  const c = l.celulas.get(field)
  return c?.pct ?? null
}

function ordenarLinhas(linhas: LinhaPanorama[], field: SortField, dir: SortDir): LinhaPanorama[] {
  return [...linhas].sort((a, b) => {
    const va = valorOrdenacao(a, field)
    const vb = valorOrdenacao(b, field)
    if (va === null && vb === null) return a.nome.localeCompare(b.nome, 'pt-BR')
    if (va === null) return 1
    if (vb === null) return -1
    const cmp = va - vb
    if (cmp !== 0) return dir === 'asc' ? cmp : -cmp
    return b.metaReferencia - a.metaReferencia
  })
}

/** Melhor atingimento da coluna (empates recebem badge). */
function topsPorMes(linhas: LinhaPanorama[], meses: string[]): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>()
  for (const mes of meses) {
    let best = -Infinity
    const ids: string[] = []
    for (const l of linhas) {
      const pct = l.celulas.get(mes)?.pct
      if (pct === null || pct === undefined) continue
      if (pct > best) {
        best = pct
        ids.length = 0
        ids.push(l.id)
      } else if (pct === best) {
        ids.push(l.id)
      }
    }
    if (ids.length > 0) out.set(mes, new Set(ids))
  }
  return out
}

function badgesCelula(
  linhaId: string,
  mes: string,
  mesIdx: number,
  meses: string[],
  linha: LinhaPanorama,
  tops: Map<string, Set<string>>
): CelulaBadge[] {
  const badges: CelulaBadge[] = []
  const c = linha.celulas.get(mes)
  if (!c || c.pct === null) return badges

  if (tops.get(mes)?.has(linhaId)) {
    badges.push({
      label: 'Top',
      variant: 'accent',
      title: 'Melhor atingimento deste mês na visão atual',
    })
  }

  if (c.pct < 80) {
    badges.push({
      label: 'Aten.',
      variant: 'warning',
      title: 'Abaixo de 80% do previsto',
    })
  }

  if (mesIdx > 0) {
    const prev = linha.celulas.get(meses[mesIdx - 1]!)
    if (prev?.pct != null && c.pct - prev.pct >= 5) {
      badges.push({
        label: '↑',
        variant: 'info',
        title: `Melhora de ${(c.pct - prev.pct).toFixed(0)} p.p. vs mês anterior`,
      })
    }
  }

  return badges
}

function CabecalhoOrdenavel({
  label,
  field,
  sortField,
  sortDir: _sortDir,
  onSort,
  className,
  align = 'right',
}: {
  label: string
  field: SortField
  sortField: SortField
  sortDir: SortDir
  onSort: (f: SortField) => void
  className?: string
  align?: 'left' | 'right'
}) {
  const active = sortField === field
  return (
    <th className={cn('py-1.5 font-medium', align === 'right' ? 'text-right' : 'text-left', className)}>
      <button
        type="button"
        className={cn(
          'inline-flex items-center gap-0.5 transition-colors hover:text-foreground',
          align === 'right' && 'ml-auto',
          active ? 'text-foreground' : 'text-muted-foreground'
        )}
        onClick={() => onSort(field)}
      >
        {label}
        <ArrowUpDown className={cn('h-3 w-3 shrink-0', active ? 'opacity-100' : 'opacity-40')} />
      </button>
    </th>
  )
}

const TIPOS: { value: Meta['tipo']; label: string }[] = [
  { value: 'faturamento', label: 'Faturamento' },
  { value: 'positivacao', label: 'Positivação' },
  { value: 'mix', label: 'Mix' },
  { value: 'clientes_estrategicos', label: 'Clientes Estratégicos' },
]

const NIVEL_LABEL: Record<'gerente' | 'supervisor' | 'vendedor', string> = {
  gerente: 'Gerência',
  supervisor: 'Supervisão',
  vendedor: 'Vendas',
}

function mesesEntre(inicio: string, fim: string): string[] {
  const out: string[] = []
  const [ai, mi] = inicio.split('-').map(Number)
  const [af, mf] = fim.split('-').map(Number)
  if (!ai || !mi || !af || !mf) return out
  let ano = ai
  let mes = mi
  while ((ano < af || (ano === af && mes <= mf)) && out.length < 24) {
    out.push(`${ano}-${String(mes).padStart(2, '0')}`)
    mes += 1
    if (mes > 12) {
      mes = 1
      ano += 1
    }
  }
  return out
}

function rotuloMes(ym: string): string {
  const [ano, mes] = ym.split('-')
  const nomes = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  return `${nomes[Number(mes) - 1] ?? mes}/${ano.slice(2)}`
}

function corAtingimento(p: number | null): string {
  if (p === null) return 'text-muted-foreground'
  if (p >= 100) return 'text-emerald-600'
  if (p >= 80) return 'text-warning'
  return 'text-red-600'
}

function mesMenos(n: number): string {
  const [ano, mes] = getCurrentMonth().split('-').map(Number)
  const d = new Date(ano, mes - 1 - n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function mesMenosDe(base: string, n: number): string {
  const [ano, mes] = base.split('-').map(Number)
  const d = new Date(ano, mes - 1 - n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

interface MetasPanoramaProps {
  distribuidorId?: string
  /** Mês de referência — janela padrão: 6 meses terminando neste mês. */
  mesReferencia?: string
}

export function MetasPanorama({ distribuidorId, mesReferencia }: MetasPanoramaProps) {
  const fimDefault = mesReferencia ?? getCurrentMonth()
  const inicioDefault = mesReferencia ? mesMenosDe(mesReferencia, 5) : mesMenos(5)

  const [gerenteId, setGerenteId] = useState<string | undefined>()
  const [supervisorId, setSupervisorId] = useState<string | undefined>()
  const [tipo, setTipo] = useState<Meta['tipo']>('faturamento')
  const [mesInicio, setMesInicio] = useState(inicioDefault)
  const [mesFim, setMesFim] = useState(fimDefault)
  const [sortField, setSortField] = useState<SortField>('meta')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const { data: hierarchy } = useVendedorHierarchy(distribuidorId)

  const nivel = useMemo((): 'gerente' | 'supervisor' | 'vendedor' => {
    if (supervisorId) return 'vendedor'
    if (gerenteId) return 'supervisor'
    return 'gerente'
  }, [gerenteId, supervisorId])

  useEffect(() => {
    setGerenteId(undefined)
    setSupervisorId(undefined)
    setSortField('meta')
    setSortDir('desc')
  }, [distribuidorId])

  useEffect(() => {
    setSortField('meta')
    setSortDir('desc')
  }, [nivel, mesInicio, mesFim, tipo])

  const { data, isLoading } = useMetasPanorama({
    distribuidorId,
    hierarquia: nivel,
    tipo,
    mesInicio,
    mesFim,
  })

  const dadosFiltrados = useMemo(() => {
    const linhas = data ?? []
    if (!hierarchy) return linhas

    if (nivel === 'supervisor' && gerenteId) {
      const ids = new Set(
        hierarchy.supervisores.filter((s) => s.supervisor_id === gerenteId).map((s) => s.id)
      )
      return linhas.filter((m) => m.vendedor_id && ids.has(m.vendedor_id))
    }

    if (nivel === 'vendedor' && supervisorId) {
      const ids = new Set(
        hierarchy.vendedoresOnly.filter((v) => v.supervisor_id === supervisorId).map((v) => v.id)
      )
      return linhas.filter((m) => m.vendedor_id && ids.has(m.vendedor_id))
    }

    return linhas
  }, [data, hierarchy, nivel, gerenteId, supervisorId])

  const meses = useMemo(() => mesesEntre(mesInicio, mesFim), [mesInicio, mesFim])

  /** Mês vigente do sistema; se estiver fora do filtro, usa o último mês visível na grade. */
  const mesVigente = useMemo(() => {
    const atual = getCurrentMonth()
    if (meses.includes(atual)) return atual
    return meses[meses.length - 1] ?? atual
  }, [meses])

  const linhasBase = useMemo((): LinhaPanorama[] => {
    const porResponsavel = new Map<
      string,
      {
        id: string
        nome: string
        celulas: Map<string, CelulaMes>
      }
    >()

    for (const m of dadosFiltrados) {
      const chave = m.vendedor_id ?? '__distribuidor__'
      const nome = m.responsavel_nome || m.vendedor_nome || m.distribuidor_nome
      if (!porResponsavel.has(chave)) {
        porResponsavel.set(chave, { id: chave, nome, celulas: new Map() })
      }
      porResponsavel.get(chave)!.celulas.set(m.periodo_inicio.slice(0, 7), {
        meta: Number(m.valor_meta),
        realizado: m.valor_realizado === null ? null : Number(m.valor_realizado),
        pct: m.percentual_atingimento === null ? null : Number(m.percentual_atingimento),
      })
    }

    return [...porResponsavel.values()].map((r) => {
      let somaMeta = 0
      let somaRealizado = 0
      for (const c of r.celulas.values()) {
        if (c.pct === null && c.realizado === null) continue
        somaMeta += c.meta
        somaRealizado += c.realizado ?? (c.pct !== null ? (c.meta * c.pct) / 100 : 0)
      }
      const metaReferencia = metaDoMes(r, mesVigente)
      return {
        ...r,
        metaReferencia,
        acumulado: somaMeta > 0 ? (somaRealizado / somaMeta) * 100 : null,
        acumuladoMeta: somaMeta,
        acumuladoRealizado: somaMeta > 0 ? somaRealizado : null,
      }
    })
  }, [dadosFiltrados, mesVigente])

  const linhas = useMemo(
    () => ordenarLinhas(linhasBase, sortField, sortDir),
    [linhasBase, sortField, sortDir]
  )

  const topsMes = useMemo(() => topsPorMes(linhasBase, meses), [linhasBase, meses])

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir(field === 'meta' ? 'desc' : 'desc')
    }
  }

  const breadcrumbs = useMemo(() => {
    const crumbs: { label: string; onClick: () => void }[] = [
      {
        label: 'Gerência',
        onClick: () => {
          setGerenteId(undefined)
          setSupervisorId(undefined)
        },
      },
    ]

    if (gerenteId && hierarchy) {
      const gerente = hierarchy.gerentes.find((g) => g.id === gerenteId)
      crumbs.push({
        label: gerente?.nome ?? 'Gerente',
        onClick: () => setSupervisorId(undefined),
      })
    }

    return crumbs
  }, [gerenteId, hierarchy])

  const podeDrill = nivel !== 'vendedor'

  function handleRowClick(id: string) {
    if (nivel === 'gerente') setGerenteId(id)
    else if (nivel === 'supervisor') setSupervisorId(id)
  }

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-border/60 bg-muted/20 px-3 py-2.5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <FilterField label="Métrica">
            <Select value={tipo} onValueChange={(v) => setTipo((v ?? 'faturamento') as Meta['tipo'])}>
              <SelectTrigger className="h-8 w-full text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>

          <FilterField label="De">
            <Input
              type="month"
              value={mesInicio}
              onChange={(e) => setMesInicio(e.target.value)}
              className="h-8 w-full text-sm"
            />
          </FilterField>

          <FilterField label="Até">
            <Input
              type="month"
              value={mesFim}
              onChange={(e) => setMesFim(e.target.value)}
              className="h-8 w-full text-sm"
            />
          </FilterField>
        </div>
      </div>

      <div className="space-y-4 p-4">
        {distribuidorId && (gerenteId || supervisorId) && (
          <nav
            aria-label="Caminho na hierarquia"
            className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-xs text-muted-foreground"
          >
            {breadcrumbs.map((crumb, idx) => (
              <span key={idx} className="inline-flex max-w-full items-center gap-1">
                {idx > 0 && <ChevronRight className="h-3 w-3 shrink-0 opacity-60" aria-hidden />}
                <button
                  type="button"
                  className="max-w-[14rem] truncate transition-colors hover:text-foreground hover:underline hover:underline-offset-2"
                  onClick={crumb.onClick}
                >
                  {crumb.label}
                </button>
              </span>
            ))}
            <ChevronRight className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
            <span className="font-medium text-foreground">{NIVEL_LABEL[nivel]}</span>
          </nav>
        )}

        {!distribuidorId ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Selecione um distribuidor para ver o panorama de atingimento.
          </p>
        ) : isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Carregando…</p>
        ) : linhas.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma meta de {TIPOS.find((t) => t.value === tipo)?.label.toLowerCase()} neste nível e
            período.
          </p>
        ) : (
          <div className="max-h-[min(36rem,65vh)] overflow-auto rounded-md border">
            <TooltipProvider delay={200}>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/30">
                  <CabecalhoOrdenavel
                    label={NIVEL_LABEL[nivel]}
                    field="meta"
                    sortField={sortField}
                    sortDir={sortDir}
                    onSort={toggleSort}
                    align="left"
                    className="sticky left-0 bg-muted/30 pr-3"
                  />
                  {meses.map((m) => (
                    <CabecalhoOrdenavel
                      key={m}
                      label={rotuloMes(m)}
                      field={m}
                      sortField={sortField}
                      sortDir={sortDir}
                      onSort={toggleSort}
                      className="whitespace-nowrap px-2"
                    />
                  ))}
                  <CabecalhoOrdenavel
                    label="Acum."
                    field="acum"
                    sortField={sortField}
                    sortDir={sortDir}
                    onSort={toggleSort}
                    className="border-l pl-2"
                  />
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr
                    key={l.id}
                    className={cn(
                      'border-b last:border-0',
                      podeDrill && 'cursor-pointer hover:bg-muted/40'
                    )}
                    onClick={podeDrill ? () => handleRowClick(l.id) : undefined}
                  >
                    <td className="sticky left-0 max-w-[220px] bg-card py-1 pr-3">
                      <span className="inline-flex max-w-full flex-col gap-0.5">
                        <span className="inline-flex max-w-full items-center gap-1">
                          <span className="truncate">{l.nome}</span>
                          {podeDrill && (
                            <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/70" />
                          )}
                        </span>
                        {l.metaReferencia > 0 && (
                          <span className="text-[10px] tabular-nums text-muted-foreground">
                            meta {rotuloMes(mesVigente)}{' '}
                            {formatValorMetrica(l.metaReferencia, tipo)}
                          </span>
                        )}
                      </span>
                    </td>
                    {meses.map((m, mesIdx) => (
                      <CelulaAtingimento
                        key={m}
                        celula={l.celulas.get(m)}
                        tipo={tipo}
                        className="px-2 py-1 text-right"
                        badges={badgesCelula(l.id, m, mesIdx, meses, l, topsMes)}
                      />
                    ))}
                    <CelulaAtingimento
                      celula={
                        l.acumulado === null
                          ? undefined
                          : {
                              meta: l.acumuladoMeta,
                              realizado: l.acumuladoRealizado,
                              pct: l.acumulado,
                            }
                      }
                      tipo={tipo}
                      className="border-l py-1 pl-2 text-right"
                      destaque
                    />
                  </tr>
                ))}
              </tbody>
            </table>
            </TooltipProvider>
          </div>
        )}

        <div className="space-y-1.5">
          <p className="text-[11px] text-muted-foreground">
            {podeDrill
              ? 'Clique em uma linha para ver o nível abaixo. Passe o mouse no % para meta e realizado.'
              : 'Passe o mouse no % para meta e realizado.'}{' '}
            Ordem padrão: maior meta do mês vigente. Clique nos cabeçalhos para reordenar.
          </p>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="accent" className="h-4 px-1.5 text-[9px]">
              <Trophy className="size-2.5" /> Top
            </Badge>
            <span className="text-[10px] text-muted-foreground self-center">melhor do mês</span>
            <Badge variant="info" className="h-4 px-1.5 text-[9px]">
              <TrendingUp className="size-2.5" /> ↑
            </Badge>
            <span className="text-[10px] text-muted-foreground self-center">+5 p.p. vs mês anterior</span>
            <Badge variant="warning" className="h-4 px-1.5 text-[9px]">
              Aten.
            </Badge>
            <span className="text-[10px] text-muted-foreground self-center">&lt; 80%</span>
          </div>
        </div>
      </div>
    </Card>
  )
}
