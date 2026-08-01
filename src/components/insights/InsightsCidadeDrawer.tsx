import { useMemo, useState } from 'react'
import { ChevronRight, MapPin, Users } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { InsightsSearchField } from '@/components/insights/InsightsSearchField'
import { InsightsClienteBrasilBadge } from '@/components/insights/InsightsClienteBrasilBadge'
import type { InsightsCidadeRow, InsightsTopCliente } from '@/types/insights'
import { formatCnpj, formatCurrency } from '@/lib/format'
import {
  enriquecerCidadesPerCapita,
  formatPerCapitaCurrency,
  type CidadePerCapita,
} from '@/lib/insights-per-capita'
import type { CidadeGapPerCapita } from '@/lib/insights-gap-per-capita'
import { InsightsGapStatus } from '@/components/insights/InsightsGapStatus'
import { useInsightsPopulacao } from '@/hooks/useInsightsPopulacao'
import { cn } from '@/lib/utils'

export type InsightsCidadeDrawerTarget = {
  cidade: string
  estado: string
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  target: InsightsCidadeDrawerTarget | null
  cidadeRow?: InsightsCidadeRow | null
  perCapita?: CidadePerCapita | null
  gap?: CidadeGapPerCapita | null
  clientes: InsightsTopCliente[]
  onSelectCliente: (c: InsightsTopCliente) => void
}

function matchCidade(c: InsightsTopCliente, cidade: string, estado: string) {
  const cc = (c.cidade ?? '').trim().toLowerCase()
  const ce = (c.estado ?? '').trim().toUpperCase()
  return cc === cidade.trim().toLowerCase() && ce === estado.trim().toUpperCase()
}

export function InsightsCidadeDrawer({
  open,
  onOpenChange,
  target,
  cidadeRow,
  perCapita,
  gap,
  clientes,
  onSelectCliente,
}: Props) {
  const [busca, setBusca] = useState('')

  const popRefs = useMemo(
    () => (target ? [{ cidade: target.cidade, estado: target.estado }] : []),
    [target]
  )
  const popQ = useInsightsPopulacao(popRefs, open && !!target && !perCapita)

  const resolvedPerCapita = useMemo(() => {
    if (perCapita) return perCapita
    if (!cidadeRow || !popQ.data?.size) return null
    return enriquecerCidadesPerCapita([cidadeRow], popQ.data)[0] ?? null
  }, [perCapita, cidadeRow, popQ.data])

  const clientesCidade = useMemo(() => {
    if (!target) return []
    return clientes
      .filter((c) => matchCidade(c, target.cidade, target.estado))
      .sort((a, b) => b.faturamento_total - a.faturamento_total)
  }, [clientes, target])

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return clientesCidade
    return clientesCidade.filter((c) => {
      const nome = (c.nome_cliente ?? '').toLowerCase()
      const razao = (c.razao_social ?? '').toLowerCase()
      const cnpj = c.cnpj_cliente.replace(/\D/g, '')
      const rede = (c.nome_rede ?? '').toLowerCase()
      return (
        nome.includes(q) ||
        razao.includes(q) ||
        cnpj.includes(q.replace(/\D/g, '')) ||
        rede.includes(q)
      )
    })
  }, [clientesCidade, busca])

  const fatTotal =
    cidadeRow?.faturamento_total ??
    clientesCidade.reduce((s, c) => s + c.faturamento_total, 0)

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) setBusca('')
        onOpenChange(next)
      }}
    >
      <SheetContent
        side="right"
        className="w-full gap-0 p-0 data-[side=right]:sm:max-w-lg"
      >
        <SheetHeader className="border-b border-border/60 px-4 py-4 space-y-1">
          <div className="flex items-start justify-between gap-2 pr-8">
            <SheetTitle className="flex min-w-0 items-center gap-2">
              <MapPin className="size-4 text-teal shrink-0" />
              <span className="truncate">{target?.cidade ?? 'Cidade'}</span>
              {target?.estado ? (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                  {target.estado}
                </Badge>
              ) : null}
            </SheetTitle>
            <InsightsGapStatus gap={gap} className="shrink-0" />
          </div>
          <SheetDescription>
            Clientes com sell-out histórico nesta cidade · clique no status para o gap ·
            no cliente para o bate-olho
          </SheetDescription>
        </SheetHeader>

        <div className="grid grid-cols-2 gap-2 border-b border-border/50 px-4 py-3 sm:grid-cols-3">
          <Kpi
            label="População"
            value={
              resolvedPerCapita?.populacao != null
                ? resolvedPerCapita.populacao.toLocaleString('pt-BR')
                : '—'
            }
          />
          <Kpi
            label="Fat. / hab"
            value={
              resolvedPerCapita != null
                ? formatPerCapitaCurrency(resolvedPerCapita.faturamento_per_capita)
                : '—'
            }
            accent
          />
          <Kpi label="Faturamento" value={formatCurrency(fatTotal)} />
          <Kpi
            label="Clientes"
            value={(cidadeRow?.total_clientes ?? clientesCidade.length).toLocaleString(
              'pt-BR'
            )}
          />
          <Kpi
            label="Potencial (ref.)"
            value={
              gap != null ? formatCurrency(gap.potencial_faturamento) : '—'
            }
          />
          <Kpi
            label="Gap"
            value={gap != null ? formatCurrency(gap.gap_faturamento) : '—'}
            accent
          />
        </div>

        <div className="border-b border-border/50 px-4 py-3">
          <InsightsSearchField
            value={busca}
            onChange={setBusca}
            placeholder="Buscar cliente, CNPJ ou rede…"
          />
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Users className="size-3" />
            {filtrados.length.toLocaleString('pt-BR')} de{' '}
            {clientesCidade.length.toLocaleString('pt-BR')} clientes
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {filtrados.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              Nenhum cliente nesta cidade com o filtro atual.
            </p>
          ) : (
            <ul className="divide-y divide-border/40">
              {filtrados.map((c) => (
                <li key={c.cnpj_cliente}>
                  <button
                    type="button"
                    onClick={() => onSelectCliente(c)}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 text-sm font-medium">
                        <span className="truncate">{c.nome_cliente}</span>
                        <InsightsClienteBrasilBadge status={c.brasil_enriquecimento_status} />
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                        {formatCnpj(c.cnpj_cliente)}
                      </p>
                      <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {formatCurrency(c.faturamento_total)}
                        </span>
                        <span className="mx-1 opacity-40">·</span>
                        {c.total_nfs} NFs
                        <span className="mx-1 opacity-40">·</span>
                        {c.total_skus} SKUs
                        {c.ultima_compra ? (
                          <>
                            <span className="mx-1 opacity-40">·</span>
                            últ.{' '}
                            {new Date(`${c.ultima_compra}T12:00:00`).toLocaleDateString(
                              'pt-BR',
                              { month: 'short', year: '2-digit' }
                            )}
                          </>
                        ) : null}
                      </p>
                    </div>
                    <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground/50" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function Kpi({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div className="rounded-md border border-border/50 bg-muted/15 px-2.5 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          'mt-0.5 text-sm font-semibold tabular-nums truncate',
          accent && 'text-teal'
        )}
      >
        {value}
      </p>
    </div>
  )
}
