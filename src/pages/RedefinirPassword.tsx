import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock } from 'lucide-react'
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
      setErro('A senha precisa ter pelo menos 8 caracteres.')
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
      setErro(err instanceof Error ? err.message : 'Falha ao atualizar senha')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return null
  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-sm space-y-2 text-center">
          <h1 className="text-lg font-semibold text-foreground">Link expirado</h1>
          <p className="text-sm text-muted-foreground">
            Pede um novo email em <a href="/recuperar-password" className="text-primary underline">recuperar senha</a>.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Define a nova senha</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Mínimo 8 caracteres. Recomendamos misturar letras, números e símbolos.
          </p>
        </div>

        {ok ? (
          <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-100">
            Senha atualizada. Redirecionando…
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <PasswordInput id="senha" label="Nova senha" value={password} onChange={setPassword} />
            <PasswordInput id="confirma" label="Confirmar senha" value={confirm} onChange={setConfirm} />

            {erro && (
              <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                {erro}
              </p>
            )}

            <Button
              type="submit"
              size="lg"
              disabled={submitting || !password || !confirm}
              className="w-full"
            >
              {submitting ? 'Atualizando…' : 'Salvar nova senha'}
            </Button>
          </form>
        )}
      </div>
    </div>
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
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <div className="relative">
        <Lock className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          type="password"
          required
          autoComplete="new-password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 pl-8 text-sm"
        />
      </div>
    </div>
  )
}
