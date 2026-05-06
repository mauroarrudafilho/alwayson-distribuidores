import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

export function RequireAuth() {
  const { loading, session, memberships } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-foreground/20 border-t-primary" />
          <p className="text-xs">Carregando sessão…</p>
        </div>
      </div>
    )
  }

  if (!session) {
    const next = `${location.pathname}${location.search}`
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />
  }

  if (memberships.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-lg font-semibold text-foreground">Acesso ainda não atribuído</h1>
          <p className="text-sm text-muted-foreground">
            Tua conta foi criada, mas ainda não tem nenhum vínculo a uma organização. Pede a
            um administrador da plataforma AlwaysOn para te atribuir um perfil.
          </p>
          <p className="text-xs text-muted-foreground">
            Suporte: <span className="font-mono">maurofilho@grupoarruda.com</span>
          </p>
        </div>
      </div>
    )
  }

  return <Outlet />
}
