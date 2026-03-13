import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Building2,
  TrendingUp,
  Award,
  Target,
  Package,
  Upload,
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
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/distribuidores', label: 'Distribuidores', icon: Building2 },
  { path: '/performance', label: 'Performance', icon: TrendingUp },
  { path: '/excelencia', label: 'Excelência', icon: Award },
  { path: '/metas', label: 'Metas', icon: Target },
  { path: '/estoque', label: 'Estoque', icon: Package },
  { path: '/ingestao', label: 'Ingestão', icon: Upload },
]

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const location = useLocation()

  return (
    <aside
      className={cn(
        'flex flex-col border-r border-border/50 bg-sidebar-background transition-all duration-200',
        collapsed ? 'w-14' : 'w-52'
      )}
    >
      <div className="flex items-center justify-between px-3 py-3 border-b border-border/50">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
              <span className="text-[10px] font-bold text-primary-foreground">D+</span>
            </div>
            <span className="text-xs font-semibold text-foreground">Distribuidor+</span>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 shrink-0"
          onClick={onToggle}
        >
          {collapsed ? (
            <ChevronRight className="w-3.5 h-3.5" />
          ) : (
            <ChevronLeft className="w-3.5 h-3.5" />
          )}
        </Button>
      </div>

      <nav className="flex-1 px-2 py-2 space-y-0.5">
        {menuItems.map((item) => {
          const isActive =
            item.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.path)

          const linkContent = (
            <Link
              to={item.path}
              className={cn(
                'flex items-center gap-2.5 h-8 px-2 rounded-md text-xs transition-colors',
                isActive
                  ? 'bg-muted font-medium text-foreground'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              )}
            >
              <item.icon
                className={cn(
                  'w-3.5 h-3.5 shrink-0',
                  isActive && 'text-primary'
                )}
              />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          )

          if (collapsed) {
            return (
              <div key={item.path} title={item.label}>
                {linkContent}
              </div>
            )
          }

          return <div key={item.path}>{linkContent}</div>
        })}
      </nav>

      <div className="px-3 py-2 border-t border-border/50">
        {!collapsed && (
          <p className="text-[10px] text-muted-foreground">AlwaysOn v1.0</p>
        )}
      </div>
    </aside>
  )
}
