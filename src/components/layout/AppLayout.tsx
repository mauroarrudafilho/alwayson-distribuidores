import { useState } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary'
import { Button } from '@/components/ui/button'
import { BrandMark } from '@/components/brand/BrandMark'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'

/**
 * Shell da aplicação.
 *
 * A navegação tem duas formas, escolhidas por CSS e não por JS — assim não há
 * salto no primeiro render nem dependência de `window`:
 * - **≥ lg**: a sidebar fica em fluxo, recolhível para uma calha de ícones.
 * - **< lg**: a sidebar sai do fluxo e passa a drawer, aberto pela barra
 *   superior. A fronteira é `lg` e não `md` porque a 768px os 232px fixos
 *   comiam 30% da largura e espremiam tabela, KPIs e cabeçalho.
 */
export function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [drawerAberto, setDrawerAberto] = useState(false)
  const location = useLocation()

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        className="hidden lg:flex"
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Drawer mobile: mesma sidebar, sempre expandida e fechando ao navegar. */}
      <Sheet open={drawerAberto} onOpenChange={setDrawerAberto}>
        <SheetContent
          side="left"
          showCloseButton={false}
          className="border-sidebar-border p-0 sm:max-w-[280px]"
        >
          <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
          <Sidebar
            className="h-full w-full border-r-0"
            collapsed={false}
            onToggle={() => setDrawerAberto(false)}
            onNavigate={() => setDrawerAberto(false)}
            showToggle={false}
          />
        </SheetContent>
      </Sheet>

      <main className="relative min-w-0 flex-1 overflow-auto">
        <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-border/70 bg-background/90 px-3 backdrop-blur-sm lg:hidden">
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 shrink-0 p-0"
            onClick={() => setDrawerAberto(true)}
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <Link
            to="/"
            className="min-w-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Mesh — início"
          >
            <BrandMark tone="onLight" size="sm" stacked={false} />
          </Link>
        </header>

        {/* Soft brand wash — keeps content light, ties to navy shell */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-56 opacity-90"
          style={{
            background:
              'radial-gradient(80% 100% at 0% 0%, oklch(0.25 0.05 250 / 4%) 0%, transparent 60%), radial-gradient(55% 80% at 100% 0%, oklch(0.70 0.15 175 / 5%) 0%, transparent 55%)',
          }}
          aria-hidden
        />
        <div className="relative mx-auto max-w-[1400px] px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
          <RouteErrorBoundary resetKey={location.pathname}>
            <Outlet />
          </RouteErrorBoundary>
        </div>
      </main>
    </div>
  )
}
