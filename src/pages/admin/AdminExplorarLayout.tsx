import { NavLink, Outlet } from 'react-router-dom'
import { cn } from '@/lib/utils'

const subTabClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'shrink-0 whitespace-nowrap px-3 py-2 text-sm transition-colors border-b-2',
    isActive
      ? 'border-primary text-foreground font-medium'
      : 'border-transparent text-muted-foreground hover:text-foreground'
  )

export function AdminExplorarLayout() {
  const base = '/admin/explorar'

  return (
    <div className="space-y-4 animate-fade-in">
      <p className="text-xs text-muted-foreground max-w-2xl">
        Parâmetros do módulo Explorar — PDVs marcados como fora do mix saem das listas e do mapa até
        serem restaurados aqui.
      </p>

      <div className="tab-strip flex gap-1 border-b border-border/50">
        <NavLink to={`${base}/desconsiderados`} className={subTabClass}>
          PDVs desconsiderados
        </NavLink>
      </div>

      <Outlet />
    </div>
  )
}
