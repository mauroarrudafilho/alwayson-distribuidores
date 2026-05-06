import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Mail } from 'lucide-react'
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
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo,
      })
      if (error) throw error
      setEnviado(true)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha ao enviar email')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar para login
        </Link>

        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Recuperar senha</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Vamos enviar um email com um link seguro para redefinires a tua senha.
          </p>
        </div>

        {enviado ? (
          <div className="rounded-md border border-border/60 bg-muted/30 p-4 text-sm">
            <p className="font-medium text-foreground">Email enviado</p>
            <p className="mt-1 text-muted-foreground">
              Se <span className="font-mono">{email}</span> tem conta na plataforma, vais receber
              instruções nos próximos minutos. Verifica também a pasta de spam.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-medium text-muted-foreground">
                Email da conta
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-10 pl-8 text-sm"
                  placeholder="nome@empresa.com"
                />
              </div>
            </div>

            {erro && (
              <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                {erro}
              </p>
            )}

            <Button type="submit" disabled={submitting || !email} className="w-full" size="lg">
              {submitting ? 'Enviando…' : 'Enviar instruções'}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
