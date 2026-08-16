import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, EyeOff, Star, Target } from 'lucide-react'
import { Panel } from '@/components/distribuidor/Panel'
import { EmptyState } from '@/components/distribuidor/EmptyState'
import { ExplorarSegmentoBadge } from '@/components/explorar/ExplorarSegmentoBadge'
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
import { PaginationBar } from '@/components/ui/pagination-bar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { usePagination } from '@/hooks/usePagination'
import { useDesconsiderarPdv } from '@/hooks/usePdvDesconsiderados'
import { formatCnpj, formatCurrency } from '@/lib/format'
import { faixaRelevanciaLabel, formatIndiceRelevancia, formatExplorarRank, PDV_FAIXA_PRIORIDADE, PDV_FAIXA_PRIORIDADE_TEXTO } from '@/lib/pdv'
import type { PdvPrioridadeRow, PdvSegmento } from '@/types/pdv'
import { cn } from '@/lib/utils'

type VisaoPrioridade = 'oportunidades' | 'carteira' | 'todos'
type FaixaFiltro = 'todos' | 'ab' | 'A' | 'B' | 'C' | 'D'

function passaFaixa(faixa: string | null | undefined, filtro: FaixaFiltro): boolean {
  if (filtro === 'todos') return true
  if (!faixa) return false
  if (filtro === 'ab') return faixa === 'A' || faixa === 'B'
  return faixa === filtro
}

type Props = {
  rows: PdvPrioridadeRow[] | undefined
  isLoading: boolean
  isError: boolean
}

export function ExplorarPrioridadeTab({ rows, isLoading, isError }: Props) {
  const [visao, setVisao] = useState<VisaoPrioridade>('oportunidades')
  const [faixaFilter, setFaixaFilter] = useState<FaixaFiltro>('ab')
  const [segmentoFilter, setSegmentoFilter] = useState<'todos' | PdvSegmento>('subexplorado')
  const [vendedorFilter, setVendedorFilter] = useState<string>('todos')
  const [soEstrategicos, setSoEstrategicos] = useState(false)
  const desconsiderar = useDesconsiderarPdv()

  const vendedores = useMemo(() => {
    const map = new Map<string, string>()
    for (const r of rows ?? []) {
      if (r.vendedor_id && r.vendedor_nome) map.set(r.vendedor_id, r.vendedor_nome)
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [rows])

  const counts = useMemo(() => {
    const list = rows ?? []
    return {
      oportunidades: list.filter((r) => !r.atendido).length,
      oportunidadesAb: list.filter(
        (r) => !r.atendido && (r.faixa === 'A' || r.faixa === 'B')
      ).length,
      carteira: list.filter((r) => r.atendido).length,
      estrategicos: list.filter((r) => r.estrategico).length,
    }
  }, [rows])

  const filtered = useMemo(() => {
    let list = rows ?? []
    if (visao === 'oportunidades') {
      list = list.filter((r) => !r.atendido && passaFaixa(r.faixa, faixaFilter))
    } else if (visao === 'carteira') {
      list = list.filter((r) => r.atendido)
      if (segmentoFilter !== 'todos') {
        list = list.filter((r) => r.segmento === segmentoFilter)
      }
      if (vendedorFilter !== 'todos') {
        list = list.filter((r) => r.vendedor_id === vendedorFilter)
      }
      list = [...list].sort(
        (a, b) => (Number(b.gap_reais) || 0) - (Number(a.gap_reais) || 0)
      )
    } else {
      list = list.filter((r) => passaFaixa(r.faixa, faixaFilter))
    }
    // Cruzamento com a lista curada: aplica-se depois da visão, para valer
    // tanto em oportunidades como em carteira.
    if (soEstrategicos) list = list.filter((r) => r.estrategico)
    return list
  }, [rows, visao, faixaFilter, segmentoFilter, vendedorFilter, soEstrategicos])

  const pag = usePagination({
    items: filtered,
    initialPageSize: 25,
    resetKey: `${visao}-${faixaFilter}-${segmentoFilter}-${vendedorFilter}-${soEstrategicos}`,
  })

  if (isLoading) {
    return <Skeleton className="h-64 w-full rounded-lg" />
  }

  if (isError) {
    return (
      <EmptyState
        icon={Target}
        title="Erro ao carregar prioridade"
        description="Não foi possível ler o ranking de oportunidades e carteira."
      />
    )
  }

  if (!rows?.length) {
    return (
      <EmptyState
        icon={Target}
        title="Nenhum PDV qualificado na praça"
        description="Rode o pipeline de score e confira se há universo carregado para esta cidade."
      />
    )
  }

  const modoOportunidade = visao === 'oportunidades' || visao === 'todos'

  return (
    <Panel accent>
      <div className="mb-4 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="font-display text-base font-normal text-foreground">
              Priorização de atendimento
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {visao === 'oportunidades'
                ? 'PDVs qualificados fora da carteira — ordenados por índice de consolidação (rede + maturidade).'
                : visao === 'carteira'
                  ? 'Clientes na carteira — sell-in vs mediana dos consolidados A/B.'
                  : 'Universo completo: oportunidades e carteira.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['oportunidades', `Oportunidades (${counts.oportunidadesAb} A/B)`],
                ['carteira', `Carteira (${counts.carteira})`],
                ['todos', 'Todos'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setVisao(id)}
                className={cn(
                  'rounded-full border px-2.5 py-0.5 text-[11px] transition-colors',
                  visao === id
                    ? 'border-navy/40 bg-navy text-white'
                    : 'border-border/70 bg-background text-muted-foreground hover:border-border'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {modoOportunidade && (
              <>
                <span className="self-center text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Faixa
                </span>
                {(
                  [
                    ['ab', 'A+B'],
                    ['A', 'A'],
                    ['B', 'B'],
                    ['C', 'C'],
                    ['D', 'D'],
                    ['todos', 'Todas'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setFaixaFilter(id)}
                    className={cn(
                      'rounded-full border px-2.5 py-0.5 text-[11px] transition-colors',
                      faixaFilter === id
                        ? 'border-teal/50 bg-teal text-white'
                        : 'border-border/70 bg-background text-muted-foreground hover:border-border'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </>
            )}
            {visao === 'carteira' && (
              <>
                <Select
                  value={segmentoFilter}
                  onValueChange={(v) => setSegmentoFilter((v ?? 'todos') as typeof segmentoFilter)}
                >
                  <SelectTrigger className="h-8 w-[180px] text-xs">
                    <SelectValue placeholder="Segmento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os segmentos</SelectItem>
                    <SelectItem value="subexplorado">Subexplorados</SelectItem>
                    <SelectItem value="maduro">Maduros</SelectItem>
                    <SelectItem value="revisar_cadastro">Revisar cadastro</SelectItem>
                    <SelectItem value="reduzir">Reduzir</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={vendedorFilter} onValueChange={(v) => setVendedorFilter(v ?? 'todos')}>
                  <SelectTrigger className="h-8 w-[180px] text-xs">
                    <SelectValue placeholder="Vendedor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos vendedores</SelectItem>
                    {vendedores.map(([id, nome]) => (
                      <SelectItem key={id} value={id}>
                        {nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}

            {counts.estrategicos > 0 && (
              <Button
                variant={soEstrategicos ? 'default' : 'outline'}
                size="sm"
                className="gap-1.5"
                onClick={() => setSoEstrategicos((v) => !v)}
                title="Cruza com a lista curada de Clientes Estratégicos"
              >
                <Star className="h-3.5 w-3.5" />
                Só estratégicos
                <span className="tabular-nums opacity-70">({counts.estrategicos})</span>
              </Button>
            )}
          </div>

          {modoOportunidade && (
            <div className="rounded-md border border-border/50 bg-muted/15 px-3 py-2.5">
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground/85">Faixas de prioridade</span>
                {' — '}
                {PDV_FAIXA_PRIORIDADE_TEXTO}
              </p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                {PDV_FAIXA_PRIORIDADE.map((f) => (
                  <span key={f.faixa} className="inline-flex items-center gap-1.5">
                    <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded border border-border/70 bg-background px-1 text-[10px] font-semibold tabular-nums text-foreground/80">
                      {f.faixa}
                    </span>
                    <span>
                      {f.quartil}
                      <span className="text-muted-foreground/75"> · {f.resumo}</span>
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {visao === 'carteira' && (
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground/85">Subexplorado</span> = cliente A ou B na
              praça comprando abaixo de 50% da mediana dos consolidados da carteira. Faixas A/B vêm do
              mesmo índice de consolidação usado em oportunidades.
            </p>
          )}
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-10">#</TableHead>
            <TableHead>PDV</TableHead>
            {modoOportunidade && <TableHead>Segmento CNAE</TableHead>}
            <TableHead>{modoOportunidade ? 'Faixa' : 'Segmento'}</TableHead>
            <TableHead className="text-right">Relevância</TableHead>
            {!modoOportunidade && (
              <>
                <TableHead className="text-right">Compra/mês</TableHead>
                <TableHead className="text-right">Gap vs med.</TableHead>
                <TableHead className="text-right">% med.</TableHead>
              </>
            )}
            {modoOportunidade && <TableHead>Bairro</TableHead>}
            <TableHead className="w-20" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {pag.paginated.map((r, i) => {
            const rank = (pag.page - 1) * pag.pageSize + i + 1
            return (
            <TableRow key={r.id}>
              <TableCell className="font-mono text-xs tabular-nums text-muted-foreground">
                {formatExplorarRank(rank)}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-sm">{r.nome_exibicao}</span>
                  {r.estrategico && (
                    <Badge
                      variant={r.estrategico_prioridade === 'alta' ? 'destructive' : 'secondary'}
                      title="Está na lista de Clientes Estratégicos"
                    >
                      <Star className="mr-0.5 h-2.5 w-2.5" />
                      {r.estrategico_prioridade === 'alta'
                        ? 'Estratégico A'
                        : r.estrategico_prioridade === 'media'
                          ? 'Estratégico B'
                          : 'Estratégico C'}
                    </Badge>
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {formatCnpj(r.cnpj)}
                  {!modoOportunidade && r.bairro ? ` · ${r.bairro}` : ''}
                </div>
                {r.vendedor_nome && (
                  <div className="text-[10px] text-muted-foreground">Vendedor: {r.vendedor_nome}</div>
                )}
                {r.atendido && (
                  <div className="text-[10px] text-teal/90">Na carteira</div>
                )}
              </TableCell>
              {modoOportunidade && (
                <TableCell className="text-sm text-muted-foreground">
                  {r.segmento_cnae ?? '—'}
                </TableCell>
              )}
              <TableCell>
                {modoOportunidade && !r.atendido ? (
                  <span className="inline-flex rounded-full border border-border/70 bg-muted/30 px-2 py-0.5 text-[11px] font-medium tabular-nums">
                    {r.faixa ? faixaRelevanciaLabel(r.faixa) : '—'}
                  </span>
                ) : (
                  <ExplorarSegmentoBadge segmento={r.segmento} />
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatIndiceRelevancia(r.potencial_estimado_mensal)}
              </TableCell>
              {!modoOportunidade && (
                <>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(r.compra_media_mensal ?? 0)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium text-warning">
                    {r.gap_reais != null ? formatCurrency(r.gap_reais) : '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {r.percentual_do_potencial != null
                      ? `${r.percentual_do_potencial.toFixed(0)}%`
                      : '—'}
                  </TableCell>
                </>
              )}
              {modoOportunidade && (
                <TableCell className="text-sm text-muted-foreground">{r.bairro ?? '—'}</TableCell>
              )}
              <TableCell>
                <div className="flex items-center justify-end gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-destructive"
                    title="Não se aplica ao nosso negócio"
                    disabled={desconsiderar.isPending}
                    onClick={() => desconsiderar.mutate({ cnpj: r.cnpj, motivo: 'fora_do_mix' })}
                  >
                    <EyeOff className="size-4" />
                  </Button>
                  {r.cliente_id && (
                    <Link
                      to={`/clientes/${r.cliente_id}`}
                      className="inline-flex text-muted-foreground hover:text-foreground"
                      aria-label="Ver cliente"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  )}
                </div>
              </TableCell>
            </TableRow>
            )
          })}
        </TableBody>
      </Table>

      {filtered.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Nenhum registro com os filtros selecionados.
        </p>
      )}

      {pag.total > 0 && (
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
  )
}
