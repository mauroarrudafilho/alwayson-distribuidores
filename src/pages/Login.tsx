import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, BarChart3, Eye, EyeOff, Lock, Mail, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/contexts/AuthContext'

export function Login() {
  const { signIn, session, loading } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const search = new URLSearchParams(location.search)
  const next = search.get('next') || '/'

  useEffect(() => {
    if (!loading && session) navigate(next, { replace: true })
  }, [loading, session, next, navigate])

  if (loading) return null
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
        /invalid login credentials/i.test(msg) ? 'Email ou senha incorretos.' : msg
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen w-full bg-background">
      <div className="flex w-full flex-1 items-center justify-center px-6 py-10 lg:w-[480px] lg:flex-none lg:px-12">
        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <span className="text-xs font-bold">A+</span>
              </div>
              <span className="text-sm font-semibold tracking-tight text-foreground">
                AlwaysOn Distribuidores
              </span>
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                Entra na tua conta
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Plataforma de inteligência comercial dos distribuidores Arruda.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-medium text-muted-foreground">
                Email
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nome@empresa.com"
                  className="h-10 pl-8 text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-xs font-medium text-muted-foreground">
                  Senha
                </label>
                <Link
                  to="/recuperar-password"
                  className="text-xs text-primary underline-offset-2 hover:underline"
                >
                  Esqueci a senha
                </Link>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-10 px-8 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? 'Esconder senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            {erro && (
              <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                {erro}
              </p>
            )}

            <Button
              type="submit"
              size="lg"
              disabled={submitting || !email || !password}
              className="w-full gap-2"
            >
              {submitting ? 'Entrando…' : 'Entrar'}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

          <div className="space-y-2 border-t border-border/50 pt-5">
            <p className="text-xs text-muted-foreground">
              Sem acesso ainda? Pede o convite ao administrador da tua organização ou escreve para{' '}
              <a
                href="mailto:maurofilho@grupoarruda.com"
                className="font-medium text-foreground hover:underline"
              >
                maurofilho@grupoarruda.com
              </a>
              .
            </p>
            <p className="text-[11px] text-muted-foreground/80">
              AlwaysOn Distribuidores · Grupo Arruda
            </p>
          </div>
        </div>
      </div>

      <div className="relative hidden flex-1 overflow-hidden lg:block">
        <div
          className="absolute inset-0 bg-gradient-to-br from-primary via-primary/85 to-primary/65"
          aria-hidden
        />
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.2) 0, transparent 35%), radial-gradient(circle at 80% 60%, rgba(255,255,255,0.15) 0, transparent 30%)',
          }}
          aria-hidden
        />
        <div className="relative z-10 flex h-full flex-col justify-between p-12 text-primary-foreground">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="h-4 w-4" />
            Inteligência comercial 360º
          </div>

          <div className="space-y-6 max-w-md">
            <h2 className="text-3xl font-semibold leading-tight tracking-tight">
              Vê o desempenho real do teu sell-out, decida com dados conectados.
            </h2>
            <p className="text-sm text-primary-foreground/85">
              Performance por distribuidor, excelência operacional, insights territoriais
              e cadastro unificado de clientes — tudo num único cockpit, com governance
              multi-tenant.
            </p>
            <ul className="space-y-2 text-sm text-primary-foreground/90">
              <li className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" /> Performance ↔ Insights ↔ Excelência num clique
              </li>
              <li className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" /> Visões por gestor, distribuidor ou fornecedor
              </li>
              <li className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" /> Ingestão automatizada e auditável
              </li>
            </ul>
          </div>

          <div className="text-xs text-primary-foreground/70">
            © {new Date().getFullYear()} Grupo Arruda · AlwaysOn Distribuidores
          </div>
        </div>
      </div>
    </div>
  )
}
