import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/auth'

export function RequireAuth() {
  const { loading, resolvingTenants, session, memberships, profile } = useAuth()
  const location = useLocation()

  if (loading || (session && resolvingTenants)) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-foreground/20 border-t-primary" />
          <p className="text-xs">
            {loading ? 'Carregando sessão…' : 'Carregando permissões…'}
          </p>
        </div>
      </div>
    )
  }

  if (!session) {
    const next = `${location.pathname}${location.search}`
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />
  }

  if (profile?.status === 'suspended') {
    return (
      <div className="flex h-screen items-center justify-center bg-[oklch(0.98_0.005_250)] px-6">
        <div className="max-w-md space-y-4 text-center">
          <p className="text-[11px] font-medium uppercase tracking-[0.32em] text-muted-foreground editorial-rule">
            Conta suspensa
          </p>
          <h1
            className="text-[36px] leading-[1.05] tracking-[-0.02em] text-foreground"
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 360,
              fontVariationSettings: '"opsz" 144, "SOFT" 30',
            }}
          >
            O seu acesso foi{' '}
            <em
              className="italic text-navy"
              style={{ fontVariationSettings: '"opsz" 144, "SOFT" 50' }}
            >
              temporariamente bloqueado.
            </em>
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Contacte o administrador da plataforma AlwaysOn se precisar de esclarecimentos.
          </p>
        </div>
      </div>
    )
  }

  if (memberships.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center bg-[oklch(0.98_0.005_250)] px-6">
        <div className="max-w-md space-y-4 text-center">
          <p className="text-[11px] font-medium uppercase tracking-[0.32em] text-muted-foreground editorial-rule">
            Acesso pendente
          </p>
          <h1
            className="text-[36px] leading-[1.05] tracking-[-0.02em] text-foreground"
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 360,
              fontVariationSettings: '"opsz" 144, "SOFT" 30',
            }}
          >
            Sua conta ainda não está{' '}
            <em
              className="italic text-navy"
              style={{ fontVariationSettings: '"opsz" 144, "SOFT" 50' }}
            >
              vinculada.
            </em>
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Sua conta foi criada, mas ainda não há vínculo com nenhuma organização. Solicite a um
            administrador da plataforma AlwaysOn para atribuir o seu perfil.
          </p>
          <p className="text-xs text-muted-foreground">
            Suporte:{' '}
            <a
              href="mailto:maurofilho@grupoarruda.com"
              className="font-medium text-foreground underline decoration-foreground/30 underline-offset-4 hover:text-navy"
            >
              maurofilho@grupoarruda.com
            </a>
          </p>
        </div>
      </div>
    )
  }

  return <Outlet />
}
