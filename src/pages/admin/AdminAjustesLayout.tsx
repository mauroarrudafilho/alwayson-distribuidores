import { NavLink, Outlet } from 'react-router-dom'
import { cn } from '@/lib/utils'

const subTabClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'px-3 py-2 text-sm transition-colors border-b-2',
    isActive
      ? 'border-primary text-foreground font-medium'
      : 'border-transparent text-muted-foreground hover:text-foreground'
  )

export function AdminAjustesLayout() {
  const base = '/admin/ajustes-cadastro'

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-wrap gap-1 border-b border-border/50">
        <NavLink to={base} end className={subTabClass}>
          Histórico de ajustes
        </NavLink>
        <NavLink to={`${base}/redes-template-vendas`} className={subTabClass}>
          Ajuste de Redes
        </NavLink>
      </div>

      <Outlet />
    </div>
  )
}
