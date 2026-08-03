import { useState, type FormEvent } from 'react'
import { ArrowRight, Eye, EyeOff, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Props = {
  submitLabel: string
  submittingLabel?: string
  onSubmit: (password: string) => Promise<void>
}

export function DefinirSenhaForm({
  submitLabel,
  submittingLabel = 'Salvando',
  onSubmit,
}: Props) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

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
      await onSubmit(password)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha ao salvar a senha.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
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
          {submitting ? submittingLabel : submitLabel}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" strokeWidth={1.75} />
        </span>
      </Button>
    </form>
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
