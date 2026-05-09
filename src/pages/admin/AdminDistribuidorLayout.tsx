import { NavLink, Outlet, useParams, Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { useDistribuidor } from '@/hooks/useDistribuidores'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/distribuidor/StatusBadge'
import { cn } from '@/lib/utils'

const subTabClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'px-3 py-2 text-sm transition-colors border-b-2',
    isActive
      ? 'border-primary text-foreground font-medium'
      : 'border-transparent text-muted-foreground hover:text-foreground'
  )

export function AdminDistribuidorLayout() {
  const { distribuidorId = '' } = useParams<{ distribuidorId: string }>()
  const { data: dist, isLoading, isError } = useDistribuidor(distribuidorId || undefined)

  const base = `/admin/distribuidores/${distribuidorId}`

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          to="/admin/distribuidores"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Distribuidores
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-40" />
        </div>
      ) : isError || !dist ? (
        <p className="text-sm text-destructive">Distribuidor não encontrado.</p>
      ) : (
        <div>
          <h2 className="text-lg font-semibold text-foreground">{dist.nome}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="tabular-nums">{dist.cnpj}</span>
            <span>
              {dist.cidade} — {dist.estado}
            </span>
            <StatusBadge status={dist.status} />
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-1 border-b border-border/50">
        <NavLink to={base} end className={subTabClass}>
          Resumo
        </NavLink>
        <NavLink to={`${base}/de-para-produtos`} className={subTabClass}>
          De-para produtos
        </NavLink>
        <NavLink to={`${base}/metas`} className={subTabClass}>
          Metas
        </NavLink>
        <NavLink to={`${base}/hierarquia`} className={subTabClass}>
          Hierarquia
        </NavLink>
      </div>

      <Outlet />
    </div>
  )
}
