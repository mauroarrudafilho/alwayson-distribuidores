import { Database, Check, X } from 'lucide-react'
import { SectionTitle } from '@/components/distribuidor/SectionTitle'
import { Panel } from '@/components/distribuidor/Panel'
import { EmptyState } from '@/components/distribuidor/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import { useSaudeDado, TIPOS_RELATORIO } from '@/hooks/useSaudeDado'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'

const LABEL_TIPO: Record<string, string> = {
  vendas: 'Vendas',
  clientes: 'Clientes',
  estoque: 'Estoque',
}

/**
 * Saúde do dado do Início — por distribuidor, quais templates do mês entraram
 * e quando chegou a última carga (Pacote A). "✗" não é erro: é dado ausente.
 */
export function SaudeDado() {
  const { data, isLoading } = useSaudeDado()

  return (
    <Panel>
      <SectionTitle title="Saúde do dado" icon={Database} />
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-8 rounded-lg" />
          <Skeleton className="h-8 rounded-lg" />
        </div>
      ) : data && data.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border/60 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                <th className="py-1.5 pr-3 font-medium">Distribuidor</th>
                {TIPOS_RELATORIO.map((t) => (
                  <th key={t} className="px-2 py-1.5 text-center font-medium">
                    {LABEL_TIPO[t]}
                  </th>
                ))}
                <th className="py-1.5 pl-3 text-right font-medium">Última chegada</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr
                  key={d.distribuidor_id}
                  className="border-b border-border/40 last:border-0"
                >
                  <td className="max-w-[200px] truncate py-2 pr-3 font-medium text-foreground">
                    {d.distribuidor_nome}
                  </td>
                  {TIPOS_RELATORIO.map((t) => {
                    const presente = d.tiposNoMes.has(t)
                    return (
                      <td key={t} className="px-2 py-2 text-center">
                        {presente ? (
                          <Check className="mx-auto h-4 w-4 text-success" strokeWidth={2} />
                        ) : (
                          <X
                            className={cn(
                              'mx-auto h-4 w-4',
                              d.ultimaChegada ? 'text-muted-foreground/40' : 'text-destructive/60'
                            )}
                            strokeWidth={2}
                          />
                        )}
                      </td>
                    )
                  })}
                  <td className="whitespace-nowrap py-2 pl-3 text-right tabular-nums text-muted-foreground">
                    {d.ultimaChegada ? formatDateTime(d.ultimaChegada) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          compact
          icon={Database}
          title="Sem distribuidores"
          description="Cadastre parceiros para acompanhar a chegada dos dados."
        />
      )}
    </Panel>
  )
}
