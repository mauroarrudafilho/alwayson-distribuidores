import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight, Loader2, MapPin, Users } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { InsightsSearchField } from '@/components/insights/InsightsSearchField'
import { formatCnpj, formatCurrency } from '@/lib/format'
import { formatPerCapitaCurrency } from '@/lib/insights-per-capita'
import { supabase } from '@/lib/supabase'
import { insightsCnpjKey } from '@/hooks/useInsightsQueries'
import { cn } from '@/lib/utils'

export type ProdutoCidadeDrawerTarget = {
  cidade: string
  estado: string
  faturamento_total: number
  total_clientes: number
  populacao: number | null
  fat_per_capita: number | null
}

type ClienteSkuCidade = {
  cnpj_cliente: string
  nome_cliente: string
  faturamento_total: number
  quantidade_total: number
  total_nfs: number
  ultima_venda: string
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  sku: string
  skuDescricao?: string
  target: ProdutoCidadeDrawerTarget | null
}

export function InsightsProdutoCidadeDrawer({
  open,
  onOpenChange,
  sku,
  skuDescricao,
  target,
}: Props) {
  const [busca, setBusca] = useState('')

  const clientesQ = useQuery({
    queryKey: [
      'insights',
      'produto-cidade-clientes',
      sku,
      target?.cidade ?? '',
      target?.estado ?? '',
    ],
    enabled: open && !!sku && !!target?.cidade && !!target?.estado,
    staleTime: 60_000,
    queryFn: async (): Promise<ClienteSkuCidade[]> => {
      const { data, error } = await supabase
        .from('alwayson_insights_v_produto_clientes')
        .select(
          'cnpj_cliente, nome_cliente, quantidade_total, faturamento_total, total_nfs, ultima_venda'
        )
        .eq('sku', sku)
        .eq('cidade', target!.cidade)
        .eq('estado', target!.estado)
        .order('faturamento_total', { ascending: false })
        .limit(200)
      if (error) throw error
      return (data ?? []).map((row) => ({
        cnpj_cliente: insightsCnpjKey(String((row as { cnpj_cliente: string }).cnpj_cliente)),
        nome_cliente: String((row as { nome_cliente: string | null }).nome_cliente ?? '—'),
        faturamento_total: Number((row as { faturamento_total: unknown }).faturamento_total) || 0,
        quantidade_total: Number((row as { quantidade_total: unknown }).quantidade_total) || 0,
        total_nfs: Math.trunc(Number((row as { total_nfs: unknown }).total_nfs)) || 0,
        ultima_venda: String((row as { ultima_venda: unknown }).ultima_venda ?? '').slice(0, 10),
      }))
    },
  })

  const clientes = clientesQ.data ?? []

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return clientes
    const digitos = q.replace(/\D/g, '')
    return clientes.filter((c) => {
      const nome = c.nome_cliente.toLowerCase()
      const cnpj = c.cnpj_cliente.replace(/\D/g, '')
      return nome.includes(q) || (digitos.length > 0 && cnpj.includes(digitos))
    })
  }, [clientes, busca])

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) setBusca('')
        onOpenChange(next)
      }}
    >
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 data-[side=right]:sm:max-w-lg">
        <SheetHeader className="space-y-1 border-b border-border/60 px-4 py-4">
          <SheetTitle className="flex min-w-0 items-center gap-2 pr-8">
            <MapPin className="size-4 shrink-0 text-teal" />
            <span className="truncate">{target?.cidade ?? 'Cidade'}</span>
            {target?.estado ? (
              <Badge variant="outline" className="shrink-0 px-1.5 py-0 text-[10px]">
                {target.estado}
              </Badge>
            ) : null}
          </SheetTitle>
          <SheetDescription>
            Clientes deste SKU na praça
            {skuDescricao ? (
              <>
                {' '}
                · <span className="text-foreground/80">{skuDescricao}</span>
              </>
            ) : (
              <>
                {' '}
                · <span className="font-mono">{sku}</span>
              </>
            )}
          </SheetDescription>
        </SheetHeader>

        {target && (
          <div className="grid grid-cols-2 gap-2 border-b border-border/50 px-4 py-3 sm:grid-cols-3">
            <Kpi label="Faturamento" value={formatCurrency(target.faturamento_total)} />
            <Kpi
              label="Clientes"
              value={target.total_clientes.toLocaleString('pt-BR')}
            />
            <Kpi
              label="População"
              value={
                target.populacao != null ? target.populacao.toLocaleString('pt-BR') : '—'
              }
            />
            <Kpi
              label="Fat. / hab"
              value={
                target.fat_per_capita != null
                  ? formatPerCapitaCurrency(target.fat_per_capita)
                  : '—'
              }
              accent
            />
          </div>
        )}

        <div className="border-b border-border/50 px-4 py-3">
          <InsightsSearchField
            value={busca}
            onChange={setBusca}
            placeholder="Buscar cliente ou CNPJ…"
          />
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Users className="size-3" />
            {clientesQ.isPending ? (
              <>
                <Loader2 className="size-3 animate-spin" /> Carregando…
              </>
            ) : (
              <>
                {filtrados.length.toLocaleString('pt-BR')} de{' '}
                {clientes.length.toLocaleString('pt-BR')} clientes
              </>
            )}
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {clientesQ.isError && (
            <p className="px-4 py-10 text-center text-sm text-destructive">
              {clientesQ.error instanceof Error
                ? clientesQ.error.message
                : 'Falha ao carregar clientes'}
            </p>
          )}
          {!clientesQ.isPending && !clientesQ.isError && filtrados.length === 0 && (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              Nenhum cliente nesta cidade para o SKU.
            </p>
          )}
          <ul className="divide-y divide-border/40">
            {filtrados.map((c) => (
              <li key={c.cnpj_cliente} className="flex items-start gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{c.nome_cliente}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                    {formatCnpj(c.cnpj_cliente)}
                  </p>
                  <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {formatCurrency(c.faturamento_total)}
                    </span>
                    <span className="mx-1 opacity-40">·</span>
                    {c.total_nfs} NFs
                    {c.ultima_venda ? (
                      <>
                        <span className="mx-1 opacity-40">·</span>
                        últ.{' '}
                        {new Date(`${c.ultima_venda}T12:00:00`).toLocaleDateString('pt-BR', {
                          month: 'short',
                          year: '2-digit',
                        })}
                      </>
                    ) : null}
                  </p>
                </div>
                <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground/40" />
              </li>
            ))}
          </ul>
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
          'mt-0.5 truncate text-sm font-semibold tabular-nums',
          accent && 'text-teal'
        )}
      >
        {value}
      </p>
    </div>
  )
}
