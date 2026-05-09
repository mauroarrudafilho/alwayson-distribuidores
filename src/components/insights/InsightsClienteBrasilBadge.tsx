import { Badge } from '@/components/ui/badge'
import type { InsightsClienteBrasilStatus } from '@/types/insights'
import {
  parseInsightsClienteBrasilStatus,
  insightsClienteBrasilStatusTitle,
} from '@/lib/insightsClienteBrasilStatus'
import { cn } from '@/lib/utils'

export function InsightsClienteBrasilBadge({
  status,
  className,
}: {
  status: InsightsClienteBrasilStatus | string | undefined | null
  className?: string
}) {
  const s = parseInsightsClienteBrasilStatus(status)
  if (!s || s === 'ready') return null

  const label =
    s === 'pending'
      ? 'Receita pendente'
      : s === 'processing'
        ? 'Processando'
        : s === 'not_found'
          ? 'Não encontrado'
          : 'Erro BrasilAPI'

  const variant =
    s === 'pending'
      ? 'secondary'
      : s === 'processing'
        ? 'default'
        : s === 'not_found'
          ? 'destructive'
          : 'outline'

  return (
    <Badge
      variant={variant}
      className={cn('text-[9px] px-1.5 py-0 shrink-0 font-normal', className)}
      title={insightsClienteBrasilStatusTitle(s)}
    >
      {label}
    </Badge>
  )
}
