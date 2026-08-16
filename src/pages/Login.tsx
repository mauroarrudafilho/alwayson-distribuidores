import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, Eye, EyeOff, KeyRound, Lock, Mail, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { BrandMark } from '@/components/brand/BrandMark'
import { MeshTerrain } from '@/components/brand/MeshTerrain'
import { useAuth } from '@/contexts/auth'
import { consumeAuthError, humanizeAuthError } from '@/lib/auth-error-bootstrap'
import { redefinirPasswordPath, userNeedsPasswordSetup } from '@/lib/auth-callback'

export function Login() {
  const { signIn, session, loading } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [authNotice, setAuthNotice] = useState<{ code: string; message: string } | null>(null)

  const search = new URLSearchParams(location.search)
  const next = search.get('next') || '/'

  useEffect(() => {
    const found = consumeAuthError()
    if (found) {
      setAuthNotice({
        code: found.code,
        message: humanizeAuthError(found.code, found.description),
      })
    }
  }, [])

  useEffect(() => {
    if (!loading && session) {
      if (userNeedsPasswordSetup(session.user.user_metadata as Record<string, unknown> | undefined)) {
        navigate(redefinirPasswordPath(next, 'invite'), { replace: true })
        return
      }
      navigate(next, { replace: true })
    }
  }, [loading, session, next, navigate])

  if (session) {
    if (userNeedsPasswordSetup(session.user.user_metadata as Record<string, unknown> | undefined)) {
      return <Navigate to={redefinirPasswordPath(next, 'invite')} replace />
    }
    return <Navigate to={next} replace />
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    setSubmitting(true)
    try {
      await signIn(email, password)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha no login'
      setErro(
        /invalid login credentials/i.test(msg)
          ? 'E-mail ou senha incorretos.'
          : /email not confirmed/i.test(msg)
            ? 'Confirme seu e-mail antes de entrar.'
            : msg
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-ink px-6 py-16 sm:px-10">
      {/* malha em tela cheia — hero, sem dado, densidade máxima (guia §6) */}
      <div className="absolute inset-0 editorial-noise opacity-[0.12] mix-blend-overlay" aria-hidden />
      <MeshTerrain density="hero" className="opacity-70" />
      <div
        className="absolute -left-40 top-1/4 h-[480px] w-[480px] rounded-full opacity-[0.12] blur-3xl"
        style={{ background: 'radial-gradient(circle, var(--color-structure-soft) 0%, transparent 65%)' }}
        aria-hidden
      />

      <div className="relative z-10 w-full max-w-[440px] text-center [animation:var(--animate-rise-in)]">
        {/* mark + wordmark, centralizados */}
        <div className="mb-10 flex flex-col items-center gap-3">
          <BrandMark tone="onDark" size="hero" markOnly />
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-sm font-medium uppercase tracking-[0.32em] text-white">Mesh</span>
            <span className="text-[10px] uppercase tracking-[0.2em] text-white/45">Canal indireto</span>
          </div>
        </div>

        {/* headline */}
        <h1
          className="text-balance text-[38px] leading-[1.05] tracking-[-0.02em] text-white sm:text-[48px]"
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 360,
            fontVariationSettings: '"opsz" 144, "SOFT" 30',
          }}
        >
          Enxergue até a{' '}
          <em className="not-italic text-amber" style={{ fontVariationSettings: '"opsz" 144, "SOFT" 80' }}>
            ponta.
          </em>
        </h1>
        <p className="mx-auto mt-4 max-w-[38ch] text-pretty text-[14px] leading-relaxed text-white/60">
          Do sell-in ao sell-out, sem ponto cego — performance, insights e clientes estratégicos num só cockpit.
        </p>

        {authNotice && (
          <div
            role="alert"
            className="mt-8 flex items-start gap-3 rounded-lg border border-warning/25 bg-warning/8 px-4 py-3 text-left text-sm leading-relaxed"
          >
            <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-warning" strokeWidth={1.75} />
            <div className="flex-1">
              <p className="font-medium text-white">Não foi possível usar o link</p>
              <p className="mt-1 text-xs text-white/60">{authNotice.message}</p>
              <Link
                to="/recuperar-password"
                className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-amber hover:underline"
              >
                Solicitar novo link <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} />
              </Link>
            </div>
          </div>
        )}

        {loading && (
          <p className="mt-8 inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/50">
            <span className="inline-block h-3 w-3 animate-spin rounded-full border border-white/25 border-t-amber" />
            Verificando sessão
          </p>
        )}

        {/* form */}
        <form onSubmit={handleSubmit} className="mt-10 space-y-5 text-left">
          <Field id="email" label="E-mail" icon={<Mail className="h-3.5 w-3.5" />}>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nome@empresa.com.br"
              className="h-12 rounded-none border-0 border-b border-white/20 bg-transparent px-0 text-base text-white shadow-none placeholder:text-white/50 focus-visible:border-amber focus-visible:ring-0"
            />
          </Field>

          <Field
            id="password"
            label="Senha"
            icon={<Lock className="h-3.5 w-3.5" />}
            right={
              <Link
                to="/recuperar-password"
                className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/45 underline-offset-4 transition-colors hover:text-amber hover:underline"
              >
                Esqueci minha senha
              </Link>
            }
          >
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••"
                className="h-12 rounded-none border-0 border-b border-white/20 bg-transparent px-0 pr-10 text-base text-white shadow-none placeholder:text-white/50 focus-visible:border-amber focus-visible:ring-0"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-0 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-white/45 transition-colors hover:text-white"
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </Field>

          {erro && (
            <p role="alert" className="rounded-lg border border-destructive/25 bg-destructive/8 px-3 py-2 text-xs leading-relaxed text-destructive">
              {erro}
            </p>
          )}

          <Button
            type="submit"
            size="lg"
            disabled={submitting || !email || !password}
            className="h-13 w-full rounded-full bg-amber text-[13px] font-medium uppercase tracking-[0.18em] text-ink shadow-[0_8px_30px_-12px_oklch(0.65_0.19_45/55%)] transition-all hover:bg-(--amber-press) hover:shadow-[0_18px_44px_-14px_oklch(0.65_0.19_45/65%)] disabled:opacity-45"
            style={{ height: 52 }}
          >
            <span className="inline-flex items-center gap-3">
              {submitting ? 'Autenticando' : 'Entrar na plataforma'}
              <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
            </span>
          </Button>
        </form>

        {/* footer */}
        <div className="mt-10 space-y-4">
          <div className="flex items-center justify-center gap-3 text-[11px] uppercase tracking-[0.16em] text-white/50">
            <ShieldCheck className="h-3.5 w-3.5 text-white/50" strokeWidth={1.75} />
            Sessão segura · TLS · multi-tenant
          </div>

          <div className="border-t border-white/10 pt-5 text-xs leading-relaxed text-white/50">
            Ainda não tem acesso? Solicite o convite ao administrador da sua organização ou
            escreva para{' '}
            <a
              href="mailto:contato@devtechlabs.com.br"
              className="font-medium text-white/75 underline decoration-white/25 underline-offset-4 transition-colors hover:decoration-amber hover:text-amber"
            >
              contato@devtechlabs.com.br
            </a>
            .
          </div>
        </div>
      </div>

      {/* assinatura, rodapé */}
      <div className="absolute inset-x-0 bottom-0 hidden items-center justify-between px-10 py-6 text-[10px] uppercase tracking-[0.2em] text-white/50 sm:flex">
        <span>{new Date().getFullYear()} · Mesh, inteligência de canal indireto</span>
        <span>v1.0</span>
      </div>
    </div>
  )
}

function Field({
  id,
  label,
  icon,
  right,
  children,
}: {
  id: string
  label: string
  icon?: React.ReactNode
  right?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="group">
      <div className="mb-1 flex items-center justify-between">
        <label
          htmlFor={id}
          className="inline-flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.22em] text-white/50 transition-colors group-focus-within:text-amber"
        >
          {icon}
          {label}
        </label>
        {right}
      </div>
      {children}
    </div>
  )
}
