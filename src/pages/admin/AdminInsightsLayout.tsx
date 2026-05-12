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
        Parâmetros globais do módulo Insights.{' '}
        <NavLink
          to="/admin/ajustes-cadastro/redes-template-vendas"
          className="text-primary underline-offset-2 hover:underline font-medium"
        >
          Ajuste de Redes
        </NavLink>{' '}
        está em Ajustes de cadastro.
      </p>

      <div className="flex flex-wrap gap-1 border-b border-border/50">
        <NavLink to={`${base}/de-para-produtos`} className={subTabClass}>
          Correlação de Produtos
        </NavLink>
        <NavLink to={`${base}/cadastro-clientes`} className={subTabClass}>
          Cadastro clientes
        </NavLink>
        <NavLink to={`${base}/redes`} className={subTabClass}>
          Redes manuais
        </NavLink>
      </div>

      <Outlet />
    </div>
  )
}
