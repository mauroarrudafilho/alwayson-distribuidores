import type { ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type InsightsChartCardProps = {
  title: string
  description?: string
  /** Altura do gráfico em px (área interna) */
  height?: number
  className?: string
  children: ReactNode
}

export function InsightsChartCard({
  title,
  description,
  height = 280,
  className,
  children,
}: InsightsChartCardProps) {
  return (
    <Card className={cn(className)}>
      <CardHeader className="pb-2 space-y-0">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        {description ? (
          <p className="text-xs text-muted-foreground font-normal pt-0.5">{description}</p>
        ) : null}
      </CardHeader>
      <CardContent className="pt-0">
        <div className="w-full" style={{ height }}>
          {children}
        </div>
      </CardContent>
    </Card>
  )
}
