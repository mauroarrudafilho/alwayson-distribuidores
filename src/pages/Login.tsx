import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, Eye, EyeOff, KeyRound, Lock, Mail, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/contexts/auth'
import { consumeAuthError, humanizeAuthError } from '@/lib/auth-error-bootstrap'

const TICKER_ROWS = [
  { label: 'Sell-out hoje', value: 'R$ 4,82M', delta: '+6,3%', tone: 'up' as const },
  { label: 'Cobertura ativa', value: '78,4%', delta: '+1,1pp', tone: 'up' as const },
  { label: 'NFs ingeridas (24h)', value: '12.418', delta: 'auditadas', tone: 'flat' as const },
  { label: 'Distribuidores online', value: '14 / 14', delta: 'OK', tone: 'up' as const },
  { label: 'Drop-off mix premium', value: '−2,1pp', delta: 'requer atenção', tone: 'down' as const },
  { label: 'Convites pendentes', value: '3', delta: 'Admin', tone: 'flat' as const },
]

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
    if (!loading && session) navigate(next, { replace: true })
  }, [loading, session, next, navigate])

  if (session) return <Navigate to={next} replace />

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
    <div className="grid min-h-screen w-full bg-[oklch(0.98_0.005_250)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      {/* ============================ FORM SIDE ============================ */}
      <section className="relative flex items-center justify-center px-6 py-12 sm:px-10 lg:px-14">
        <div className="absolute inset-x-0 top-0 hidden h-px bg-linear-to-r from-transparent via-foreground/10 to-transparent lg:block" />

        <div className="w-full max-w-[420px] [animation:var(--animate-rise-in)]">
          {/* eyebrow */}
          <div className="mb-12 flex items-center justify-between text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-teal" />
              AlwaysOn · Distribuidores
            </span>
            <span>v1.0</span>
          </div>

          {/* headline */}
          <p className="text-[11px] font-medium uppercase tracking-[0.32em] text-muted-foreground editorial-rule">
            Entrar
          </p>
          <h1
            className="mt-3 text-[42px] leading-[1.02] tracking-[-0.02em] text-foreground sm:text-[52px]"
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 360,
              fontVariationSettings: '"opsz" 144, "SOFT" 30',
            }}
          >
            Bem-vindo de
            <br />
            <em
              className="italic text-navy"
              style={{ fontVariationSettings: '"opsz" 144, "SOFT" 50' }}
            >
              volta.
            </em>
          </h1>

          {authNotice && (
            <div
              role="alert"
              className="mt-8 flex items-start gap-3 border-l-2 border-amber-500 bg-amber-500/5 px-4 py-3 text-sm leading-relaxed"
            >
              <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" strokeWidth={1.75} />
              <div className="flex-1">
                <p className="font-medium text-foreground">Não foi possível usar o link</p>
                <p className="mt-1 text-xs text-muted-foreground">{authNotice.message}</p>
                <Link
                  to="/recuperar-password"
                  className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-navy hover:underline"
                >
                  Solicitar novo link <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} />
                </Link>
              </div>
            </div>
          )}

          {loading && (
            <p className="mt-8 inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              <span className="inline-block h-3 w-3 animate-spin rounded-full border border-foreground/30 border-t-navy" />
              Verificando sessão
            </p>
          )}

          {/* form */}
          <form onSubmit={handleSubmit} className="mt-12 space-y-5">
            <Field
              id="email"
              label="E-mail corporativo"
              icon={<Mail className="h-3.5 w-3.5" />}
            >
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nome@empresa.com.br"
                className="h-12 rounded-none border-0 border-b border-foreground/15 bg-transparent px-0 text-base shadow-none focus-visible:border-navy focus-visible:ring-0"
              />
            </Field>

            <Field
              id="password"
              label="Senha"
              icon={<Lock className="h-3.5 w-3.5" />}
              right={
                <Link
                  to="/recuperar-password"
                  className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground underline-offset-4 transition-colors hover:text-navy hover:underline"
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
                  className="h-12 rounded-none border-0 border-b border-foreground/15 bg-transparent px-0 pr-10 text-base shadow-none focus-visible:border-navy focus-visible:ring-0"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-0 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>

            {erro && (
              <p
                role="alert"
                className="border-l-2 border-destructive bg-destructive/4 px-3 py-2 text-xs leading-relaxed text-destructive"
              >
                {erro}
              </p>
            )}

            <Button
              type="submit"
              size="lg"
              disabled={submitting || !email || !password}
              className="group relative h-13 w-full overflow-hidden rounded-full bg-navy text-[13px] font-medium uppercase tracking-[0.18em] text-primary-foreground shadow-[0_8px_30px_-12px_oklch(0.25_0.05_250/55%)] transition-all hover:bg-navy-hover hover:shadow-[0_18px_44px_-14px_oklch(0.25_0.05_250/65%)] disabled:bg-(--navy)/55"
              style={{ height: 52 }}
            >
              <span className="relative z-10 inline-flex items-center gap-3">
                {submitting ? 'Autenticando' : 'Entrar na plataforma'}
                <ArrowRight
                  className="h-4 w-4 transition-transform group-hover:translate-x-1"
                  strokeWidth={1.75}
                />
              </span>
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 w-0 bg-linear-to-r from-(--teal)/0 via-(--teal)/30 to-(--teal)/0 transition-all duration-700 group-hover:w-full"
              />
            </Button>
          </form>

          {/* footer */}
          <div className="mt-12 space-y-4">
            <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-teal" strokeWidth={1.75} />
              Sessão segura · TLS · multi-tenant
            </div>

            <div className="border-t border-foreground/10 pt-5 text-xs leading-relaxed text-muted-foreground">
              Ainda não tem acesso? Solicite o convite ao administrador da sua organização ou
              escreva para{' '}
              <a
                href="mailto:maurofilho@grupoarruda.com"
                className="font-medium text-foreground underline decoration-foreground/30 underline-offset-4 transition-colors hover:decoration-navy hover:text-navy"
              >
                maurofilho@grupoarruda.com
              </a>
              .
            </div>
          </div>
        </div>

        {/* footer signature */}
        <div className="absolute inset-x-0 bottom-0 hidden items-center justify-between px-14 py-6 text-[10px] uppercase tracking-[0.2em] text-muted-foreground lg:flex">
          <span>© {new Date().getFullYear()} Grupo Arruda</span>
          <span>AlwaysOn · Commercial Intelligence</span>
        </div>
      </section>

      {/* ============================ HERO SIDE ============================ */}
      <section
        className="relative hidden overflow-hidden text-primary-foreground lg:block"
        style={{
          background:
            'radial-gradient(120% 80% at 90% 0%, oklch(0.32 0.06 200 / 55%) 0%, transparent 55%), radial-gradient(120% 80% at 0% 100%, oklch(0.20 0.05 250) 0%, transparent 50%), linear-gradient(135deg, oklch(0.18 0.045 252) 0%, oklch(0.22 0.05 248) 50%, oklch(0.16 0.05 256) 100%)',
        }}
      >
        {/* layered effects */}
        <div className="absolute inset-0 editorial-grid opacity-[0.55]" aria-hidden />
        <div className="absolute inset-0 editorial-noise opacity-[0.35] mix-blend-overlay" aria-hidden />
        <div
          className="absolute -left-32 top-1/3 h-[520px] w-[520px] rounded-full opacity-30 blur-3xl"
          style={{ background: 'radial-gradient(circle, var(--teal) 0%, transparent 65%)' }}
          aria-hidden
        />

        {/* corner ticks */}
        <CornerTick className="left-6 top-6" />
        <CornerTick className="right-6 top-6" rotate={90} />
        <CornerTick className="left-6 bottom-6" rotate={-90} />
        <CornerTick className="right-6 bottom-6" rotate={180} />

        {/* big editorial number */}
        <div
          className="pointer-events-none absolute -bottom-[10%] -right-[6%] select-none text-[28rem] leading-none text-white/4"
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 300,
            fontVariationSettings: '"opsz" 144, "SOFT" 100',
          }}
          aria-hidden
        >
          01
        </div>

        <div className="relative z-10 flex h-full flex-col justify-between p-14 xl:p-16">
          {/* top: brand */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="relative flex h-11 w-11 items-center justify-center rounded-md border border-white/15 bg-white/4 backdrop-blur-sm">
                <span
                  className="text-base text-white"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 500,
                    fontVariationSettings: '"opsz" 12',
                  }}
                >
                  A
                </span>
                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-teal shadow-[0_0_12px_var(--teal)]" />
              </div>
              <div className="flex flex-col leading-tight">
                <span className="text-sm font-medium tracking-tight">AlwaysOn Distribuidores</span>
                <span className="text-[10px] uppercase tracking-[0.22em] text-white/55">
                  Grupo Arruda · 2026
                </span>
              </div>
            </div>

            <div className="rounded-full border border-white/15 bg-white/4 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-white/75 backdrop-blur-sm">
              <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              Live · sell-out conectado
            </div>
          </div>

          {/* middle: claim */}
          <div className="max-w-xl space-y-7">
            <h2
              className="text-[68px] leading-[0.96] tracking-[-0.03em] xl:text-[84px]"
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 320,
                fontVariationSettings: '"opsz" 144, "SOFT" 30',
              }}
            >
              Do sell-out
              <br />
              <span className="text-white/85">à </span>
              <em
                className="italic text-teal"
                style={{ fontVariationSettings: '"opsz" 144, "SOFT" 80' }}
              >
                decisão.
              </em>
            </h2>

            <p className="max-w-[40ch] text-[15px] leading-relaxed text-white/70">
              Performance, insights e excelência — num só cockpit, com governança multi-tenant.
            </p>

            <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-3">
              {[
                { n: '01', t: 'Performance', s: 'sell-out, mix, cobertura' },
                { n: '02', t: 'Insights', s: 'territorial · cliente · NF' },
                { n: '03', t: 'Excelência', s: 'cadastro · auditoria · convites' },
              ].map((f) => (
                <div
                  key={f.n}
                  className="group rounded-md border border-white/10 bg-white/2.5 p-4 transition-colors hover:border-white/25 hover:bg-white/5"
                >
                  <div
                    className="text-xs text-white/45"
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontVariationSettings: '"opsz" 12',
                    }}
                  >
                    {f.n}
                  </div>
                  <div className="mt-2 text-sm font-medium tracking-tight text-white">{f.t}</div>
                  <div className="mt-0.5 text-[11px] uppercase tracking-[0.12em] text-white/50">
                    {f.s}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* bottom: live ticker */}
          <div className="relative">
            <div className="mb-3 flex items-center justify-between text-[10px] uppercase tracking-[0.22em] text-white/55">
              <span>Snapshot · últimos 60 min</span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal" />
                ao vivo
              </span>
            </div>

            <div className="relative h-[112px] overflow-hidden rounded-md border border-white/10 bg-white/2.5">
              <div
                className="flex flex-col [animation:var(--animate-ticker)]"
                style={{ willChange: 'transform' }}
              >
                {[...TICKER_ROWS, ...TICKER_ROWS].map((row, i) => (
                  <TickerLine key={`${row.label}-${i}`} {...row} />
                ))}
              </div>
              {/* fade masks */}
              <div className="pointer-events-none absolute inset-x-0 top-0 h-6 bg-linear-to-b from-[oklch(0.18_0.045_252)] to-transparent" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-linear-to-t from-[oklch(0.18_0.045_252)] to-transparent" />
            </div>
          </div>
        </div>
      </section>
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
          className="inline-flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground transition-colors group-focus-within:text-navy"
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

function CornerTick({ className = '', rotate = 0 }: { className?: string; rotate?: number }) {
  return (
    <span
      aria-hidden
      className={`absolute h-3 w-3 ${className}`}
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      <span className="absolute left-0 top-0 h-px w-full bg-white/30" />
      <span className="absolute left-0 top-0 h-full w-px bg-white/30" />
    </span>
  )
}

function TickerLine({
  label,
  value,
  delta,
  tone,
}: {
  label: string
  value: string
  delta: string
  tone: 'up' | 'down' | 'flat'
}) {
  const toneClass =
    tone === 'up'
      ? 'text-emerald-300'
      : tone === 'down'
        ? 'text-rose-300'
        : 'text-white/55'

  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-baseline gap-4 border-b border-white/6 px-4 py-2.5 last:border-b-0">
      <span className="truncate text-[11px] uppercase tracking-[0.16em] text-white/55">{label}</span>
      <span
        className="text-base text-white tabular-nums"
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 380,
          fontVariationSettings: '"opsz" 12',
        }}
      >
        {value}
      </span>
      <span className={`text-[11px] uppercase tracking-[0.16em] tabular-nums ${toneClass}`}>
        {delta}
      </span>
    </div>
  )
}
