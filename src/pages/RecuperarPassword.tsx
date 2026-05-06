import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Mail, MailCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'

export function RecuperarPassword() {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    setSubmitting(true)
    try {
      const redirectTo = `${window.location.origin}/redefinir-password`
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo })
      if (error) throw error
      setEnviado(true)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha ao enviar e-mail.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell eyebrow="Recuperar acesso" title="Esqueceu a senha?" italic="Sem problema.">
      <p className="mt-4 max-w-[36ch] text-sm leading-relaxed text-muted-foreground">
        Informe o e-mail vinculado à sua conta e enviaremos um link seguro para você definir uma
        nova senha.
      </p>

      {enviado ? (
        <div className="mt-10 border-l-2 border-teal bg-(--teal)/5 px-5 py-4 text-sm">
          <div className="flex items-center gap-2 font-medium text-foreground">
            <MailCheck className="h-4 w-4 text-teal" strokeWidth={1.75} />
            E-mail enviado
          </div>
          <p className="mt-2 leading-relaxed text-muted-foreground">
            Se <span className="font-medium text-foreground">{email}</span> tiver conta na
            plataforma, você receberá as instruções nos próximos minutos. Confira também a pasta
            de spam ou promoções.
          </p>
          <Link
            to="/login"
            className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-navy hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar para o login
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-10 space-y-5">
          <Field id="email" label="E-mail da conta" icon={<Mail className="h-3.5 w-3.5" />}>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 rounded-none border-0 border-b border-foreground/15 bg-transparent px-0 text-base shadow-none focus-visible:border-navy focus-visible:ring-0"
              placeholder="nome@empresa.com.br"
              autoComplete="email"
            />
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
            disabled={submitting || !email}
            className="group h-13 w-full rounded-full bg-navy text-[13px] font-medium uppercase tracking-[0.18em] text-primary-foreground shadow-[0_8px_30px_-12px_oklch(0.25_0.05_250/55%)] transition-all hover:bg-navy-hover hover:shadow-[0_18px_44px_-14px_oklch(0.25_0.05_250/65%)] disabled:bg-(--navy)/55"
            style={{ height: 52 }}
          >
            <span className="inline-flex items-center gap-3">
              {submitting ? 'Enviando' : 'Enviar instruções'}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" strokeWidth={1.75} />
            </span>
          </Button>

          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar para o login
          </Link>
        </form>
      )}
    </AuthShell>
  )
}

function Field({
  id,
  label,
  icon,
  children,
}: {
  id: string
  label: string
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="group">
      <label
        htmlFor={id}
        className="mb-1 inline-flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground transition-colors group-focus-within:text-navy"
      >
        {icon}
        {label}
      </label>
      {children}
    </div>
  )
}

function AuthShell({
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
