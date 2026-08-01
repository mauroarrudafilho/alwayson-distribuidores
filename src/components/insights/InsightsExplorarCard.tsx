import type { ReactNode } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { InsightsSearchField } from '@/components/insights/InsightsSearchField'
import { cn } from '@/lib/utils'

type Props = {
  /** Ex.: "Base filtrada" / "Explorar cidades" / "Mix detalhado" */
  title: string
  /** Contagem à direita do título */
  countLabel?: string
  search: string
  onSearchChange: (value: string) => void
  searchPlaceholder?: string
  children: ReactNode
  className?: string
  /** Conteúdo opcional acima da busca (ex.: chips) */
  toolbar?: ReactNode
}

/**
 * Casca visual única para explorar listas (clientes / produtos / cidades):
 * cabeçalho + busca universal + conteúdo (tabela/paginação).
 */
export function InsightsExplorarCard({
  title,
  countLabel,
  search,
  onSearchChange,
  searchPlaceholder = 'Buscar…',
  children,
  className,
  toolbar,
}: Props) {
  return (
    <Card className={cn(className)}>
      <CardContent className="p-0">
        <div className="border-b border-border/50 px-4 py-3 space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {title}
              {countLabel ? (
                <span className="ml-1.5 font-normal normal-case tracking-normal text-muted-foreground/80">
                  · {countLabel}
                </span>
              ) : null}
            </p>
          </div>
          <InsightsSearchField
            value={search}
            onChange={onSearchChange}
            placeholder={searchPlaceholder}
          />
          {toolbar}
        </div>
        {children}
      </CardContent>
    </Card>
  )
}
