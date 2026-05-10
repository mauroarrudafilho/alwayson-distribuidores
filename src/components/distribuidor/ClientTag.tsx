import { cn } from '@/lib/utils'

export type ClientTagCategory = 'programa' | 'fonte' | 'segmento' | 'flag' | 'risk'

interface ClientTagProps {
  category: ClientTagCategory
  label: string
  className?: string
}

const categoryClass: Record<ClientTagCategory, string> = {
  programa: 'text-teal border-teal/30 bg-teal/8',
  fonte: 'text-info border-info/30 bg-info/8',
  segmento: 'text-muted-foreground border-border bg-muted',
  flag: 'text-warning border-warning/30 bg-warning/8',
  risk: 'text-destructive border-destructive/30 bg-destructive/8',
}

const dotClass: Record<ClientTagCategory, string> = {
  programa: 'bg-teal',
  fonte: 'bg-info',
  segmento: 'bg-muted-foreground/60',
  flag: 'bg-warning',
  risk: 'bg-destructive',
}

export function ClientTag({ category, label, className }: ClientTagProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold leading-tight tracking-wide tabular-nums',
        categoryClass[category],
        className
      )}
    >
      <span className={cn('h-[5px] w-[5px] rounded-full', dotClass[category])} aria-hidden />
      {label}
    </span>
  )
}

export function ClientTagStack({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn('inline-flex flex-wrap gap-1', className)}>{children}</span>
}
