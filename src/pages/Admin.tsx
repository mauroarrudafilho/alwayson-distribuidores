import { Outlet, Navigate, useLocation, Link } from 'react-router-dom'
import { PageHeader } from '@/components/distribuidor/PageHeader'

const adminTabs = [
  { path: '/admin/insights', label: 'Insights', prefix: true },
  { path: '/admin/produtos', label: 'Produtos', prefix: false },
  { path: '/admin/usuarios', label: 'Usuários', prefix: false },
  { path: '/admin/ajustes-cadastro', label: 'Ajustes de cadastro', prefix: true },
]

function tabActive(pathname: string, path: string, prefix: boolean) {
  if (prefix) return pathname === path || pathname.startsWith(`${path}/`)
  return pathname === path
}

export function Admin() {
  const location = useLocation()

  if (location.pathname === '/admin') {
    return <Navigate to="/admin/usuarios" replace />
  }

  return (
    <div className="animate-page-in">
      <PageHeader
        title="Administração"
        accent="do cockpit"
        description="o que é da plataforma — o de cada parceiro fica em Parceiros"
      />
      <div className="tab-strip mb-6 flex gap-1 border-b border-border/60">
        {adminTabs.map((tab) => (
          <Link
            key={tab.path}
            to={tab.path}
            className={`shrink-0 border-b-2 px-3 py-2 text-[13px] whitespace-nowrap transition-colors ${
              tabActive(location.pathname, tab.path, tab.prefix)
                ? 'border-teal font-medium text-foreground'
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
