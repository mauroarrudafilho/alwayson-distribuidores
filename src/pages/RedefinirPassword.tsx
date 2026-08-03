import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { AuthShell } from '@/components/auth/AuthShell'
import { DefinirSenhaForm } from '@/components/auth/DefinirSenhaForm'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/auth'
import { clearAuthHash } from '@/lib/auth-callback'
import { useAuthCallbackSession } from '@/hooks/useAuthCallbackSession'

export function RedefinirPassword() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { resolvingCallback, authFlowType } = useAuthCallbackSession(loading, session)
  const [ok, setOk] = useState(false)

  const next = searchParams.get('next') || '/'
  const flow = searchParams.get('flow')
  const isInviteFlow = flow === 'invite' || authFlowType === 'invite'

  useEffect(() => {
    if (ok) {
      const t = setTimeout(() => navigate(next, { replace: true }), 1500)
      return () => clearTimeout(t)
    }
  }, [ok, navigate, next])

  async function handleSubmit(password: string) {
    const { error } = await supabase.auth.updateUser({
      password,
      data: { needs_password_setup: false },
    })
    if (error) throw error
    clearAuthHash()
    setOk(true)
  }

  if (loading || resolvingCallback) {
    return (
      <AuthShell
        eyebrow={isInviteFlow ? 'Primeiro acesso' : 'Redefinir senha'}
        title="Verificando"
        italic="seu acesso…"
      >
        <p className="mt-6 inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border border-foreground/30 border-t-navy" />
          Validando link seguro
        </p>
      </AuthShell>
    )
  }

  if (!session) {
    return (
      <AuthShell eyebrow="Redefinir senha" title="Link" italic="expirado.">
        <p className="mt-4 max-w-[36ch] text-sm leading-relaxed text-muted-foreground">
          Por segurança, os links de redefinição expiram após algumas horas ou só podem ser usados
          uma vez. Solicite um novo e-mail e tente novamente.
        </p>
        <Link
          to="/recuperar-password"
          className="mt-8 inline-flex h-12 items-center gap-3 rounded-full bg-navy px-6 text-[13px] font-medium uppercase tracking-[0.18em] text-primary-foreground transition-colors hover:bg-navy-hover"
        >
          Pedir novo link <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
        </Link>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      eyebrow={isInviteFlow ? 'Primeiro acesso' : 'Redefinir senha'}
      title={isInviteFlow ? 'Crie sua' : 'Defina sua'}
      italic="senha."
    >
      <p className="mt-4 max-w-[36ch] text-sm leading-relaxed text-muted-foreground">
        {isInviteFlow
          ? 'Por segurança, você precisa criar uma senha pessoal antes de acessar dados da plataforma.'
          : 'Mínimo de 8 caracteres. Recomendamos misturar letras maiúsculas, números e símbolos.'}
      </p>

      {ok ? (
        <div className="mt-10 border-l-2 border-emerald-500 bg-emerald-500/5 px-5 py-4 text-sm">
          <div className="flex items-center gap-2 font-medium text-foreground">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" strokeWidth={1.75} />
            Senha definida
          </div>
          <p className="mt-2 leading-relaxed text-muted-foreground">
            {isInviteFlow
              ? 'Redirecionando para concluir seu convite…'
              : 'Tudo certo. Estamos te redirecionando para a plataforma…'}
          </p>
        </div>
      ) : (
        <DefinirSenhaForm
          submitLabel={isInviteFlow ? 'Continuar' : 'Salvar nova senha'}
          submittingLabel="Salvando"
          onSubmit={handleSubmit}
        />
      )}
    </AuthShell>
  )
}
