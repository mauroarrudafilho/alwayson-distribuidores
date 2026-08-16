import { Badge } from '@/components/ui/badge'
import { PDV_SEGMENTO_LABEL } from '@/lib/pdv'
import type { PdvSegmento } from '@/types/pdv'
import { cn } from '@/lib/utils'

const variant: Record<PdvSegmento, string> = {
  subexplorado: 'bg-warning/15 text-warning border-warning/30',
  maduro: 'bg-emerald-500/15 text-emerald-900 border-emerald-500/30',
  revisar_cadastro: 'bg-sky-500/15 text-sky-900 border-sky-500/30',
  reduzir: 'bg-muted text-muted-foreground border-border',
  nao_atendido: 'bg-violet-500/15 text-violet-900 border-violet-500/30',
}

export function ExplorarSegmentoBadge({ segmento }: { segmento: PdvSegmento }) {
  return (
    <Badge variant="outline" className={cn('font-normal', variant[segmento])}>
      {PDV_SEGMENTO_LABEL[segmento] ?? segmento}
    </Badge>
  )
}
