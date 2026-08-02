import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  TrendingUp,
  Award,
  Target,
  UserSearch,
  Package,
  Settings,
  Upload,
  BarChart3,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { TenantSwitcher } from '@/components/auth/TenantSwitcher'
import { BrandMark } from '@/components/brand/BrandMark'

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
  { path: '/metas', label: 'Metas', icon: Target, group: 'analise' },
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
        'relative flex flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200',
        collapsed ? 'w-[60px]' : 'w-[232px]'
      )}
    >
      {/* Atmosphere — same family as login hero, quieter */}
      <div
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          background:
            'radial-gradient(120% 70% at 100% 0%, oklch(0.32 0.06 200 / 35%) 0%, transparent 55%), radial-gradient(90% 60% at 0% 100%, oklch(0.16 0.05 256 / 80%) 0%, transparent 55%)',
        }}
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-0 editorial-grid opacity-40" aria-hidden />

      <div
        className={cn(
          'relative z-10 border-b border-sidebar-border',
          collapsed
            ? 'flex flex-col items-center gap-1.5 px-2 py-3'
            : 'flex items-center gap-1 px-2.5 py-3'
        )}
      >
        <Link
          to="/"
          className={cn(
            'rounded-md outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
            !collapsed && 'min-w-0 flex-1'
          )}
          aria-label="AlwaysOn Distribuidores — início"
        >
          <BrandMark tone="onDark" size="sm" markOnly={collapsed} stacked />
        </Link>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 shrink-0 p-0 text-sidebar-foreground/55 hover:bg-sidebar-accent hover:text-sidebar-foreground"
          onClick={onToggle}
          aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-3.5 w-3.5" />
          ) : (
            <PanelLeftClose className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>

      <nav className="relative z-10 flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
        {menuItems.map((item, idx) => {
          const prevGroup = idx > 0 ? menuItems[idx - 1].group : null
          const startsNewGroup = item.group !== prevGroup

          const isActive =
            item.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.path)

          return (
            <div key={item.path} title={collapsed ? item.label : undefined}>
              {startsNewGroup &&
                (collapsed ? (
                  idx > 0 && <div className="mx-2 my-2.5 border-t border-sidebar-border" />
                ) : (
                  <p
                    className={cn(
                      'px-2.5 text-[10px] font-medium uppercase tracking-[0.2em] text-sidebar-foreground/40',
                      idx === 0 ? 'mb-1.5' : 'mt-4 mb-1.5'
                    )}
                  >
                    {GROUP_LABELS[item.group]}
                  </p>
                ))}
              <Link
                to={item.path}
                className={cn(
                  'group relative flex h-9 items-center gap-2.5 rounded-md px-2.5 text-[13px] transition-colors',
                  collapsed && 'justify-center px-0',
                  isActive
                    ? 'bg-sidebar-accent font-medium text-sidebar-foreground'
                    : 'text-sidebar-foreground/65 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground'
                )}
              >
                {isActive && (
                  <span
                    className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-teal"
                    aria-hidden
                  />
                )}
                <item.icon
                  className={cn(
                    'h-4 w-4 shrink-0 transition-colors',
                    isActive
                      ? 'text-teal'
                      : 'text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80'
                  )}
                />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            </div>
          )
        })}
      </nav>

      <div className="relative z-10 space-y-1.5 border-t border-sidebar-border p-2">
        <TenantSwitcher collapsed={collapsed} />
        {!collapsed && (
          <p className="px-2 pb-0.5 text-[10px] uppercase tracking-[0.16em] text-sidebar-foreground/35">
            DevTech Labs · CI
          </p>
        )}
      </div>
    </aside>
  )
}
