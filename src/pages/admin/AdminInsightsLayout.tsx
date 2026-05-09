import { NavLink, Outlet } from 'react-router-dom'
import { cn } from '@/lib/utils'

const subTabClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'px-3 py-2 text-sm transition-colors border-b-2',
    isActive
      ? 'border-primary text-foreground font-medium'
      : 'border-transparent text-muted-foreground hover:text-foreground'
  )

export function AdminInsightsLayout() {
  const base = '/admin/insights'

  return (
    <div className="space-y-4 animate-fade-in">
      <p className="text-xs text-muted-foreground max-w-2xl">
        Parâmetros globais do módulo Insights: de-para produtos e acompanhamento do cadastro territorial
        (Receita / BrasilAPI) dos clientes na dimensão Insights.
      </p>

      <div className="flex flex-wrap gap-1 border-b border-border/50">
        <NavLink to={`${base}/de-para-produtos`} className={subTabClass}>
          De-para produtos
        </NavLink>
        <NavLink to={`${base}/cadastro-clientes`} className={subTabClass}>
          Cadastro clientes
        </NavLink>
      </div>

      <Outlet />
    </div>
  )
}
