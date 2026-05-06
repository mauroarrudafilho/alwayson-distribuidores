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

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

const menuItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard, group: 'operacional' },
  { path: '/performance', label: 'Performance', icon: TrendingUp, group: 'operacional' },
  { path: '/excelencia', label: 'Excelência', icon: Award, group: 'operacional' },
  { path: '/clientes', label: 'Clientes', icon: UserSearch, group: 'operacional' },
  { path: '/estoque', label: 'Estoque', icon: Package, group: 'operacional' },
  { path: '/insights', label: 'Insights', icon: BarChart3, group: 'operacional' },
  { path: '/admin', label: 'Administração', icon: Settings, group: 'admin' },
  { path: '/ingestao', label: 'Ingestão', icon: Upload, group: 'admin' },
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
          const prevGroup = idx > 0 ? menuItems[idx - 1].group : item.group
          const showSeparator = item.group !== prevGroup

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
              {showSeparator && (
                <div className="my-2 mx-2 border-t border-border/50" />
              )}
              {linkContent}
            </div>
          )
        })}
      </nav>

      <div className="px-3 py-2 border-t border-border/50">
        {!collapsed && (
          <p className="text-[11px] text-muted-foreground">AlwaysOn v1.0</p>
        )}
      </div>
    </aside>
  )
}
