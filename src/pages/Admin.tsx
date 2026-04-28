import { Outlet, Navigate, useLocation, Link } from 'react-router-dom'
import { PageHeader } from '@/components/distribuidor/PageHeader'

const adminTabs = [
  { path: '/admin/distribuidores', label: 'Distribuidores' },
  { path: '/admin/produtos', label: 'Produtos' },
  { path: '/admin/metas', label: 'Metas' },
  { path: '/admin/excelencia', label: 'Excelência' },
  { path: '/admin/usuarios', label: 'Usuários' },
  { path: '/admin/ajustes-cadastro', label: 'Ajustes de cadastro' },
]

export function Admin() {
  const location = useLocation()

  if (location.pathname === '/admin') {
    return <Navigate to="/admin/distribuidores" replace />
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Administração"
        description="Cockpit de Parâmetros"
      />
      <div className="flex gap-1 border-b border-border/50 mb-6">
        {adminTabs.map((tab) => (
          <Link
            key={tab.path}
            to={tab.path}
            className={`px-3 py-2 text-sm transition-colors border-b-2 ${
              location.pathname === tab.path
                ? 'border-primary text-foreground font-medium'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>
      <Outlet />
    </div>
  )
}
