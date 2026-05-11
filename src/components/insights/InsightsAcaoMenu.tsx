import {
  Clock,
  Archive,
  PlayCircle,
  CheckCircle2,
  Circle,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import {
  type InsightsAcao,
  type InsightsAcaoEstado,
  useUpsertInsightsAcao,
} from '@/hooks/useInsightsAcoes'

export const INSIGHTS_ACAO_LABEL: Record<InsightsAcaoEstado, string> = {
  pendente: 'Pendente',
  em_acao: 'Em ação',
  resolvido: 'Resolvido',
  snooze: 'Snooze',
  arquivado: 'Arquivado',
}

const ESTADO_CLASS: Record<InsightsAcaoEstado, string> = {
  pendente:
    'border-border/60 text-muted-foreground bg-transparent',
  em_acao:
    'border-amber-500/40 text-amber-700 dark:text-amber-400 bg-amber-50/70 dark:bg-amber-950/30',
  resolvido:
    'border-emerald-500/40 text-emerald-700 dark:text-emerald-400 bg-emerald-50/70 dark:bg-emerald-950/30',
  snooze:
    'border-slate-500/30 text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/40',
  arquivado:
    'border-border/40 text-muted-foreground/70 bg-muted/40',
}

function snoozeDateFromDays(days: number): string {
  const d = new Date(Date.now() + days * 86400_000)
  return d.toISOString().slice(0, 10)
}

function formatSnoozeShort(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
  })
}

interface InsightsAcaoMenuProps {
  cnpj: string
  acao?: InsightsAcao
  /** Texto extra antes do label do estado (ex.: "Status"). */
  prefixLabel?: string
}

/**
 * Pill clicável que mostra o estado da ação e abre menu com as transições.
 * Usar dentro de uma linha clicável: stopPropagation já incluso.
 */
export function InsightsAcaoMenu({ cnpj, acao, prefixLabel }: InsightsAcaoMenuProps) {
  const mut = useUpsertInsightsAcao()
  const estado: InsightsAcaoEstado = acao?.estado ?? 'pendente'
  const snoozeUntil = acao?.snooze_until ?? null

  const setEstado = (next: InsightsAcaoEstado, snoozeDays?: number) => {
    const snooze_until = snoozeDays ? snoozeDateFromDays(snoozeDays) : null
    mut.mutate({
      cnpj_cliente: cnpj,
      estado: next,
      snooze_until,
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5',
          'text-[10px] font-semibold uppercase tracking-wider transition-colors',
          'hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-ring/30',
          ESTADO_CLASS[estado]
        )}
      >
        {prefixLabel && (
          <span className="font-normal normal-case opacity-70">{prefixLabel}</span>
        )}
        <span>{INSIGHTS_ACAO_LABEL[estado]}</span>
        {estado === 'snooze' && snoozeUntil && (
          <span className="font-normal normal-case opacity-70">
            até {formatSnoozeShort(snoozeUntil)}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        onClick={(e) => e.stopPropagation()}
        className="w-44"
      >
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Status da ação
        </DropdownMenuLabel>
        <DropdownMenuItem
          onClick={() => setEstado('em_acao')}
          disabled={estado === 'em_acao' || mut.isPending}
        >
          <PlayCircle className="w-3.5 h-3.5" />
          Em ação
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setEstado('resolvido')}
          disabled={estado === 'resolvido' || mut.isPending}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          Resolvido
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => setEstado('snooze', 7)}
          disabled={mut.isPending}
        >
          <Clock className="w-3.5 h-3.5" />
          Snooze 7 dias
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setEstado('snooze', 30)}
          disabled={mut.isPending}
        >
          <Clock className="w-3.5 h-3.5" />
          Snooze 30 dias
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setEstado('arquivado')}
          disabled={estado === 'arquivado' || mut.isPending}
        >
          <Archive className="w-3.5 h-3.5" />
          Arquivar
        </DropdownMenuItem>
        {estado !== 'pendente' && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setEstado('pendente')}
              disabled={mut.isPending}
            >
              <Circle className="w-3.5 h-3.5" />
              Voltar a pendente
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
