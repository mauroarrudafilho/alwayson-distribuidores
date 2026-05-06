import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center py-12">
      <Icon className="w-12 h-12 text-muted-foreground/30" />
      <p className="text-sm font-medium text-foreground mt-4">{title}</p>
      {description && (
        <p className="text-xs text-muted-foreground mt-1 max-w-sm text-center">
          {description}
        </p>
      )}
      {action && (
        <Button variant="outline" size="sm" className="mt-4" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  )
}
