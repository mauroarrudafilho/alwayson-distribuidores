import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/auth'

/** Bloqueia `/admin/*` — só admin global da plataforma. */
export function RequireAdmin() {
  const { loading, isAdmin } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-foreground/20 border-t-primary" />
      </div>
    )
  }

  if (!isAdmin) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}
