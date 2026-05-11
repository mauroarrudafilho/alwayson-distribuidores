import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  TrendingUp,
  Award,
  UserSearch,
  Package,
  Settings,
  Upload,
  BarChart3,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { TenantSwitcher } from '@/components/auth/TenantSwitcher'

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

type MenuGroup = 'analise' | 'operacao' | 'setup'

const GROUP_LABELS: Record<MenuGroup, string> = {
  analise: 'Análise',
  operacao: 'Operação',
  setup: 'Setup',
}

const menuItems: { path: string; label: string; icon: typeof LayoutDashboard; group: MenuGroup }[] = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard, group: 'analise' },
  { path: '/performance', label: 'Performance', icon: TrendingUp, group: 'analise' },
  { path: '/excelencia', label: 'Excelência', icon: Award, group: 'analise' },
  { path: '/insights', label: 'Insights', icon: BarChart3, group: 'analise' },
  { path: '/clientes', label: 'Clientes', icon: UserSearch, group: 'operacao' },
  { path: '/estoque', label: 'Estoque', icon: Package, group: 'operacao' },
  { path: '/admin', label: 'Administração', icon: Settings, group: 'setup' },
  { path: '/ingestao', label: 'Ingestão', icon: Upload, group: 'setup' },
]

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const location = useLocation()

  return (
    <aside
      className={cn(
        'flex flex-col border-r border-border/50 bg-sidebar-background transition-all duration-200',
        collapsed ? 'w-14' : 'w-56'
      )}
    >
      <div className="flex items-center justify-between px-3 py-3 border-b border-border/50">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
              <span className="text-[11px] font-bold text-primary-foreground">D+</span>
            </div>
            <span className="text-sm font-semibold text-foreground">Distribuidor+</span>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 shrink-0"
          onClick={onToggle}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </Button>
      </div>

      <nav className="flex-1 px-2 py-2 space-y-0.5">
        {menuItems.map((item, idx) => {
          const prevGroup = idx > 0 ? menuItems[idx - 1].group : null
          const startsNewGroup = item.group !== prevGroup

          const isActive =
            item.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.path)

          const linkContent = (
            <Link
              to={item.path}
              className={cn(
                'flex items-center gap-2.5 h-9 px-2.5 rounded-md text-sm transition-colors',
                isActive
                  ? 'bg-muted font-medium text-foreground'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              )}
            >
              <item.icon
                className={cn(
                  'w-4 h-4 shrink-0',
                  isActive && 'text-primary'
                )}
              />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          )

          return (
            <div key={item.path} title={collapsed ? item.label : undefined}>
              {startsNewGroup && (
                collapsed ? (
                  idx > 0 && <div className="my-2 mx-2 border-t border-border/50" />
                ) : (
                  <p
                    className={cn(
                      'px-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/60',
                      idx === 0 ? 'mb-1' : 'mt-3 mb-1'
                    )}
                  >
                    {GROUP_LABELS[item.group]}
                  </p>
                )
              )}
              {linkContent}
            </div>
          )
        })}
      </nav>

      <div className="border-t border-border/50 p-2 space-y-1">
        <TenantSwitcher collapsed={collapsed} />
        {!collapsed && (
          <p className="px-2 text-[10px] text-muted-foreground/70">AlwaysOn v1.0</p>
        )}
      </div>
    </aside>
  )
}
