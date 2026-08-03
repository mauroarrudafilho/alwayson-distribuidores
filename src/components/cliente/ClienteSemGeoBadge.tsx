import { Badge } from '@/components/ui/badge'
import { isCidadeVazia } from '@/lib/cliente-cidade'
import { cn } from '@/lib/utils'

export function ClienteSemGeoBadge({
  cidade,
  estado,
  className,
}: {
  cidade?: string | null
  estado?: string | null
  className?: string
}) {
  if (!isCidadeVazia(cidade, estado)) return null

  return (
    <Badge
      variant="outline"
      className={cn(
        'shrink-0 border-amber-500/35 bg-amber-500/8 px-1.5 py-0 text-[9px] font-normal text-amber-800 dark:text-amber-400',
        className
      )}
      title="UF e cidade não localizados (Insights e BrasilAPI)"
    >
      Sem geo
    </Badge>
  )
}
