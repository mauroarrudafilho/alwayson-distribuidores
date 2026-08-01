import { useState, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary'

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  )
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return isMobile
}

export function AppLayout() {
  const isMobile = useIsMobile()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const location = useLocation()

  useEffect(() => {
    if (isMobile) setSidebarCollapsed(true)
  }, [isMobile])

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <main className="relative min-w-0 flex-1 overflow-auto">
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
