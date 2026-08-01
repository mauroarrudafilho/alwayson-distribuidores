import { useMemo, useState } from 'react'
import { Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { InsightsSearchField } from '@/components/insights/InsightsSearchField'
import type { InsightsTopCliente } from '@/types/insights'
import type { ClientePotencialExclusao } from '@/lib/insights-gap-per-capita'
import { formatCidadeUf, formatCnpj, formatCurrency } from '@/lib/format'
import { insightsCnpjKey } from '@/hooks/useInsightsQueries'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 80

type Props = {
  clientes: InsightsTopCliente[]
  excluded: ReadonlySet<string>
  excludedClientes: InsightsTopCliente[]
  suggestions: ClientePotencialExclusao[]
  onToggle: (cnpj: string) => void
  onAddSuggested: () => void
  onClearAll: () => void
  count: number
  /** Fecha e leva à aba Território para ver potencial/gap atualizados. */
  onVerTerritorio?: () => void
}

/**
 * Engrenagem Insights: monta a lista de clientes fora do potencial.
 * Em "Todos", carteira completa por fat. decrescente — adiciona um a um.
 */
export function InsightsParametrizacaoDialog({
  clientes,
  excluded,
  excludedClientes,
  suggestions,
  onToggle,
  onAddSuggested,
  onClearAll,
  count,
  onVerTerritorio,
}: Props) {
  const [open, setOpen] = useState(false)
  const [busca, setBusca] = useState('')
  const [tab, setTab] = useState<'excluidos' | 'sugeridos' | 'todos'>('todos')
  const [visible, setVisible] = useState(PAGE_SIZE)

  const clientesPorFat = useMemo(
    () => [...clientes].sort((a, b) => b.faturamento_total - a.faturamento_total),
    [clientes]
  )

  const todosFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    const digits = busca.replace(/\D/g, '')
    if (!q && digits.length < 2) return clientesPorFat
    return clientesPorFat.filter((c) => {
      const cnpj = insightsCnpjKey(c.cnpj_cliente)
      const nome = (c.nome_cliente ?? '').toLowerCase()
      const razao = (c.razao_social ?? '').toLowerCase()
      const cidade = (c.cidade ?? '').toLowerCase()
      return (
        nome.includes(q) ||
        razao.includes(q) ||
        cidade.includes(q) ||
        (digits.length >= 2 && cnpj.includes(digits))
      )
    })
  }, [busca, clientesPorFat])

  const todosVisiveis = todosFiltrados.slice(0, visible)

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 gap-1.5 text-xs"
        onClick={() => {
          setTab('todos')
          setVisible(PAGE_SIZE)
          setOpen(true)
        }}
        title="Parametrização do Insights"
      >
        <Settings2 className="size-3.5" />
        Parametrização
        {count > 0 ? (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {count}
          </Badge>
        ) : null}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[min(92vh,760px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
          <DialogHeader className="border-b border-border/60 px-4 py-4 space-y-1">
            <DialogTitle className="pr-8 text-base">Parametrização · Insights</DialogTitle>
            <DialogDescription>
              Adicione à lista os clientes que <strong>não devem entrar</strong> no cálculo de
              potencial. A conta de potencial/gap <strong>atualiza na hora</strong> — não precisa
              reprocessar. Ranking, status e gap usam a conta limpa na hora; o total
              histórico da cidade continua visível como referência.
              {clientes.length > 0 ? (
                <span className="mt-1 block tabular-nums text-foreground/70">
                  {clientes.length.toLocaleString('pt-BR')} na carteira · {count} retirados do
                  potencial
                </span>
              ) : null}
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-1 border-b border-border/50 px-4 py-2">
            {(
              [
                ['todos', `Todos (${clientes.length.toLocaleString('pt-BR')})`],
                ['sugeridos', `Sugeridos (${suggestions.length})`],
                ['excluidos', `Na lista (${count})`],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setTab(id)
                  if (id === 'todos') setVisible(PAGE_SIZE)
                }}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                  tab === id
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'excluidos' && (
            <div className="flex flex-wrap gap-2 border-b border-border/40 px-4 py-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={onClearAll}
                disabled={count === 0}
              >
                Limpar lista
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-7 text-xs"
                onClick={onAddSuggested}
                disabled={suggestions.length === 0}
              >
                Adicionar todos os sugeridos
              </Button>
            </div>
          )}

          {tab === 'todos' && (
            <div className="space-y-2 border-b border-border/40 px-4 py-3">
              <InsightsSearchField
                value={busca}
                onChange={(v) => {
                  setBusca(v)
                  setVisible(PAGE_SIZE)
                }}
                placeholder="Filtrar por nome, CNPJ ou cidade…"
              />
              <p className="text-[11px] text-muted-foreground">
                Ordenado por faturamento (maior → menor). Clique em{' '}
                <span className="font-medium text-foreground">Adicionar</span> para retirar do
                potencial.
              </p>
            </div>
          )}

          {tab === 'sugeridos' && (
            <div className="border-b border-border/40 px-4 py-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-7 text-xs"
                onClick={onAddSuggested}
              >
                Adicionar todos os sugeridos à lista
              </Button>
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto">
            {tab === 'excluidos' && (
              <ListaNaExclusao
                rows={excludedClientes}
                onRemove={onToggle}
                empty="Lista vazia. Em Todos ou Sugeridos, use Adicionar para retirar do potencial."
              />
            )}

            {tab === 'sugeridos' && (
              <ul className="divide-y divide-border/40">
                {suggestions.length === 0 ? (
                  <li className="px-4 py-10 text-center text-sm text-muted-foreground">
                    Sem sugestões no recorte atual.
                  </li>
                ) : (
                  suggestions.map((s) => (
                    <ClienteRow
                      key={s.cnpj}
                      nome={s.nome}
                      cnpj={s.cnpj}
                      fat={s.faturamento_total}
                      cidade={s.cidade}
                      estado={s.estado}
                      meta={s.reasons.join(' · ')}
                      naLista={excluded.has(s.cnpj)}
                      onToggle={() => onToggle(s.cnpj)}
                    />
                  ))
                )}
              </ul>
            )}

            {tab === 'todos' && (
              <>
                <ul className="divide-y divide-border/40">
                  {todosVisiveis.length === 0 ? (
                    <li className="px-4 py-10 text-center text-sm text-muted-foreground">
                      Nenhum cliente encontrado.
                    </li>
                  ) : (
                    todosVisiveis.map((c) => {
                      const cnpj = insightsCnpjKey(c.cnpj_cliente)
                      return (
                        <ClienteRow
                          key={cnpj}
                          nome={c.nome_cliente ?? '—'}
                          cnpj={cnpj}
                          fat={c.faturamento_total}
                          cidade={c.cidade}
                          estado={c.estado}
                          naLista={excluded.has(cnpj)}
                          onToggle={() => onToggle(cnpj)}
                        />
                      )
                    })
                  )}
                </ul>
                {visible < todosFiltrados.length ? (
                  <div className="border-t border-border/40 px-4 py-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => setVisible((n) => n + PAGE_SIZE)}
                    >
                      Ver mais ({Math.min(PAGE_SIZE, todosFiltrados.length - visible)} de{' '}
                      {(todosFiltrados.length - visible).toLocaleString('pt-BR')} restantes)
                    </Button>
                  </div>
                ) : null}
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 bg-muted/30 px-4 py-3">
            <p className="text-[11px] text-muted-foreground">
              Potencial recalcula ao adicionar/remover · veja na aba Território
            </p>
            <Button
              type="button"
              size="sm"
              className="h-8 text-xs"
              onClick={() => {
                setOpen(false)
                onVerTerritorio?.()
              }}
            >
              Ver Território
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function ClienteRow({
  nome,
  cnpj,
  fat,
  cidade,
  estado,
  meta,
  naLista,
  onToggle,
}: {
  nome: string
  cnpj: string
  fat: number
  cidade?: string
  estado?: string
  meta?: string
  naLista: boolean
  onToggle: () => void
}) {
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{nome}</p>
        <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
          {formatCnpj(cnpj)}
        </p>
        <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
          {formatCurrency(fat)}
          <span className="mx-1 opacity-40">·</span>
          {formatCidadeUf(cidade, estado)}
        </p>
        {meta ? (
          <p className="mt-1 text-[11px] text-muted-foreground">{meta}</p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'shrink-0 rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide',
          naLista
            ? 'border-border bg-muted/50 text-muted-foreground'
            : 'border-teal/35 bg-teal/10 text-teal'
        )}
      >
        {naLista ? 'Remover' : 'Adicionar'}
      </button>
    </li>
  )
}

function ListaNaExclusao({
  rows,
  onRemove,
  empty,
}: {
  rows: InsightsTopCliente[]
  onRemove: (cnpj: string) => void
  empty: string
}) {
  if (rows.length === 0) {
    return <p className="px-4 py-10 text-center text-sm text-muted-foreground">{empty}</p>
  }
  return (
    <ul className="divide-y divide-border/40">
      {rows.map((c) => {
        const cnpj = insightsCnpjKey(c.cnpj_cliente)
        return (
          <ClienteRow
            key={cnpj}
            nome={c.nome_cliente ?? '—'}
            cnpj={cnpj}
            fat={c.faturamento_total}
            cidade={c.cidade}
            estado={c.estado}
            naLista
            onToggle={() => onRemove(cnpj)}
          />
        )
      })}
    </ul>
  )
}
