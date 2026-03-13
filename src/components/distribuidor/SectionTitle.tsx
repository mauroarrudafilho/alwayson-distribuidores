import type { LucideIcon } from 'lucide-react'

interface SectionTitleProps {
  title: string
  icon: LucideIcon
}

export function SectionTitle({ title, icon: Icon }: SectionTitleProps) {
  return (
    <div className="flex items-center gap-1.5 mb-2">
      <Icon className="w-3 h-3 text-muted-foreground" />
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </span>
    </div>
  )
}
