import { TableCell } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { Minisserie } from './Minisserie'
import type { SerieEntidade } from '@/hooks/useSerieEntidade'

interface Props {
  serie: SerieEntidade | undefined
  /** Percentual já calculado; null quando não há contraparte. */
  variacao: number | null
  className?: string
}

export function ColunaEvolucao({ serie, variacao, className }: Props) {
  return (
    <TableCell className={cn('text-right tabular-nums', className)}>
      <div className="flex items-center justify-end gap-2">
        {variacao === null ? (
          <span className="text-xs text-muted-foreground">—</span>
        ) : (
          <span
            className={cn(
              'text-xs font-semibold',
              variacao >= 0 ? 'text-success' : 'text-destructive'
            )}
          >
            {variacao >= 0 ? '+' : ''}
            {variacao.toFixed(1)}%
          </span>
        )}
        {serie && (
          <Minisserie
            valores={serie.valores}
            positivo={variacao === null ? null : variacao >= 0}
          />
        )}
      </div>
    </TableCell>
  )
}

/** Variação do total da janela contra o total da comparação; null sem contraparte. */
export function calcularVariacaoLinha(
  atual: SerieEntidade | undefined,
  anterior: SerieEntidade | undefined
): number | null {
  if (!atual || !anterior || anterior.total === 0) return null
  return ((atual.total - anterior.total) / anterior.total) * 100
}
