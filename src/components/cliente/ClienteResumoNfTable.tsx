import { useEffect, useState, type ReactNode } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { Faturamento } from '@/types/faturamento'
import type { ItemEnriquecido } from '@/lib/produto-depara-display'
import { formatCurrency, formatDate } from '@/lib/format'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

function useCanHover() {
  const [canHover, setCanHover] = useState(true)
  useEffect(() => {
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)')
    const update = () => setCanHover(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return canHover
}

function NfItensPanel({
  itens,
  inverted,
}: {
  itens: ItemEnriquecido[]
  inverted?: boolean
}) {
  if (itens.length === 0) {
    return (
      <p className={cn('text-xs', inverted ? 'text-background/80' : 'text-muted-foreground')}>
        Sem itens nesta NF
      </p>
    )
  }

  return (
    <ul className="space-y-1.5">
      {itens.map((item) => (
        <li
          key={`${item.sku}-${item.descricao}`}
          className={cn(
            'flex items-start justify-between gap-3 text-xs',
            inverted ? 'text-background' : 'text-foreground'
          )}
        >
          <span className="min-w-0 flex-1">
            <span className="font-mono text-[10px] opacity-80">{item.sku}</span>
            <span className="mt-0.5 block break-words leading-snug">{item.descricao}</span>
          </span>
          <span className="shrink-0 text-right tabular-nums">
            <span className="block">{item.quantidade.toLocaleString('pt-BR')} un</span>
            <span className={cn('block', inverted ? 'opacity-90' : 'text-muted-foreground')}>
              {formatCurrency(item.valor_total)}
            </span>
          </span>
        </li>
      ))}
    </ul>
  )
}

interface Props {
  nfs: Faturamento[]
  itensByNf: Map<string, ItemEnriquecido[]>
  loading?: boolean
}

export function ClienteResumoNfTable({ nfs, itensByNf, loading }: Props) {
  const canHover = useCanHover()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const hint = canHover
    ? 'Passe o mouse na NF para ver os produtos'
    : 'Toque na linha para ver os produtos da NF'

  if (loading) {
    return (
      <div className="rounded-md border px-3 py-6 text-center text-xs text-muted-foreground">
        Carregando itens…
      </div>
    )
  }

  if (nfs.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">Nenhuma NF registrada</p>
    )
  }

  return (
    <TooltipProvider delay={200}>
      <p className="mb-1.5 text-[10px] text-muted-foreground">{hint}</p>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {!canHover && <TableHead className="h-8 w-6" />}
              <TableHead className="h-8 text-xs">Data</TableHead>
              <TableHead className="h-8 text-xs">NF</TableHead>
              <TableHead className="h-8 text-right text-xs">Valor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {nfs.map((fat) => {
              const itens = itensByNf.get(fat.id) ?? []
              const expanded = expandedId === fat.id

              return (
                <NfRow
                  key={fat.id}
                  fat={fat}
                  itens={itens}
                  canHover={canHover}
                  expanded={expanded}
                  onToggle={() =>
                    setExpandedId((cur) => (cur === fat.id ? null : fat.id))
                  }
                />
              )
            })}
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  )
}

function NfRow({
  fat,
  itens,
  canHover,
  expanded,
  onToggle,
}: {
  fat: Faturamento
  itens: ItemEnriquecido[]
  canHover: boolean
  expanded: boolean
  onToggle: () => void
}) {
  const panel = <NfItensPanel itens={itens} inverted={canHover} />

  const nfCell = (
    <span
      className={cn(
        'font-mono',
        canHover && itens.length > 0 && 'border-b border-dotted border-muted-foreground/50'
      )}
    >
      {fat.numero_nf}
    </span>
  )

  let nfContent: ReactNode = nfCell
  if (canHover && itens.length > 0) {
    nfContent = (
      <Tooltip>
        <TooltipTrigger
          type="button"
          className="cursor-help p-0 text-left font-mono text-xs underline-offset-2 hover:underline"
        >
          {fat.numero_nf}
        </TooltipTrigger>
        <TooltipContent
          side="left"
          align="start"
          className="max-w-[min(26rem,92vw)] w-max px-3 py-2 text-left"
        >
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider opacity-80">
            NF {fat.numero_nf}
          </p>
          {panel}
        </TooltipContent>
      </Tooltip>
    )
  }

  return (
    <>
      <TableRow
        className={cn(
          'hover:bg-muted/30',
          !canHover && itens.length > 0 && 'cursor-pointer'
        )}
        onClick={!canHover && itens.length > 0 ? onToggle : undefined}
      >
        {!canHover && (
          <TableCell className="py-2 pr-0 text-muted-foreground">
            {itens.length > 0 ? (
              expanded ? (
                <ChevronDown className="size-3.5" />
              ) : (
                <ChevronRight className="size-3.5" />
              )
            ) : null}
          </TableCell>
        )}
        <TableCell className="py-2 text-xs">{formatDate(fat.data_emissao)}</TableCell>
        <TableCell className="py-2 text-xs">{nfContent}</TableCell>
        <TableCell className="py-2 text-right text-xs tabular-nums">
          {formatCurrency(fat.valor_total)}
        </TableCell>
      </TableRow>
      {!canHover && expanded && itens.length > 0 && (
        <TableRow className="bg-muted/20 hover:bg-muted/20">
          <TableCell colSpan={4} className="px-3 py-2">
            <NfItensPanel itens={itens} />
          </TableCell>
        </TableRow>
      )}
    </>
  )
}
