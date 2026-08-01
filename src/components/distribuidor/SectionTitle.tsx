import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface SectionTitleProps {
  title: string
  icon?: LucideIcon
  action?: ReactNode
  className?: string
}

export function SectionTitle({ title, icon: Icon, action, className }: SectionTitleProps) {
  return (
    <div className={cn('mb-3 flex items-center justify-between gap-3', className)}>
      <div className="flex min-w-0 items-center gap-2">
        {Icon && <Icon className="h-3.5 w-3.5 shrink-0 text-teal" strokeWidth={1.75} />}
        <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {title}
        </span>
      </div>
      {action}
    </div>
  )
}
