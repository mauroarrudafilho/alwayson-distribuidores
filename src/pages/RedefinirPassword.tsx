import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, CheckCircle2, Eye, EyeOff, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

export function RedefinirPassword() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  useEffect(() => {
    if (ok) {
      const t = setTimeout(() => navigate('/', { replace: true }), 1500)
      return () => clearTimeout(t)
    }
  }, [ok, navigate])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    if (password.length < 8) {
      setErro('A senha precisa ter ao menos 8 caracteres.')
      return
    }
    if (password !== confirm) {
      setErro('As senhas não coincidem.')
      return
    }
    setSubmitting(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setOk(true)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha ao atualizar a senha.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return null

  if (!session) {
    return (
      <Shell eyebrow="Redefinir senha" title="Link" italic="expirado.">
        <p className="mt-4 max-w-[36ch] text-sm leading-relaxed text-muted-foreground">
          Por segurança, os links de redefinição expiram após algumas horas. Solicite um novo
          e-mail e tente novamente.
        </p>
        <Link
          to="/recuperar-password"
          className="mt-8 inline-flex h-12 items-center gap-3 rounded-full bg-navy px-6 text-[13px] font-medium uppercase tracking-[0.18em] text-primary-foreground transition-colors hover:bg-navy-hover"
        >
          Pedir novo link <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
        </Link>
      </Shell>
    )
  }

  return (
    <Shell eyebrow="Redefinir senha" title="Defina sua" italic="nova senha.">
      <p className="mt-4 max-w-[36ch] text-sm leading-relaxed text-muted-foreground">
        Mínimo de 8 caracteres. Recomendamos misturar letras maiúsculas, números e símbolos para
        proteger seu acesso.
      </p>

      {ok ? (
        <div className="mt-10 border-l-2 border-emerald-500 bg-emerald-500/5 px-5 py-4 text-sm">
          <div className="flex items-center gap-2 font-medium text-foreground">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" strokeWidth={1.75} />
            Senha atualizada
          </div>
          <p className="mt-2 leading-relaxed text-muted-foreground">
            Tudo certo. Estamos te redirecionando para a plataforma…
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-10 space-y-5">
          <PasswordInput id="senha" label="Nova senha" value={password} onChange={setPassword} />
          <PasswordInput id="confirma" label="Confirmar senha" value={confirm} onChange={setConfirm} />

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
            disabled={submitting || !password || !confirm}
            className="group h-13 w-full rounded-full bg-navy text-[13px] font-medium uppercase tracking-[0.18em] text-primary-foreground shadow-[0_8px_30px_-12px_oklch(0.25_0.05_250/55%)] transition-all hover:bg-navy-hover hover:shadow-[0_18px_44px_-14px_oklch(0.25_0.05_250/65%)] disabled:bg-(--navy)/55"
            style={{ height: 52 }}
          >
            <span className="inline-flex items-center gap-3">
              {submitting ? 'Atualizando' : 'Salvar nova senha'}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" strokeWidth={1.75} />
            </span>
          </Button>
        </form>
      )}
    </Shell>
  )
}

function PasswordInput({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="group">
      <label
        htmlFor={id}
        className="mb-1 inline-flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground transition-colors group-focus-within:text-navy"
      >
        <Lock className="h-3.5 w-3.5" />
        {label}
      </label>
      <div className="relative">
        <Input
          id={id}
          type={show ? 'text' : 'password'}
          required
          autoComplete="new-password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-12 rounded-none border-0 border-b border-foreground/15 bg-transparent px-0 pr-10 text-base shadow-none focus-visible:border-navy focus-visible:ring-0"
          placeholder="••••••••••"
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute right-0 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground"
          aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  )
}

function Shell({
  eyebrow,
  title,
  italic,
  children,
}: {
  eyebrow: string
  title: string
  italic: string
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[oklch(0.98_0.005_250)] px-6 py-10 sm:px-10">
      <div className="w-full max-w-[440px] [animation:var(--animate-rise-in)]">
        <div className="mb-12 flex items-center justify-between text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-teal" />
            AlwaysOn · Distribuidores
          </span>
          <span>v1.0</span>
        </div>
        <p className="text-[11px] font-medium uppercase tracking-[0.32em] text-muted-foreground editorial-rule">
          {eyebrow}
        </p>
        <h1
          className="mt-3 text-[42px] leading-[1.02] tracking-[-0.02em] text-foreground sm:text-[48px]"
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 360,
            fontVariationSettings: '"opsz" 144, "SOFT" 30',
          }}
        >
          {title}{' '}
          <em
            className="italic text-navy"
            style={{ fontVariationSettings: '"opsz" 144, "SOFT" 50' }}
          >
            {italic}
          </em>
        </h1>
        {children}
      </div>
    </div>
  )
}
