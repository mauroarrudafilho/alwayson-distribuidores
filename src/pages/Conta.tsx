import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AtSign,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LogOut,
  ShieldAlert,
  ShieldCheck,
  User as UserIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/distribuidor/PageHeader'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

export function Conta() {
  const { user, profile, refresh, signOut } = useAuth()

  return (
    <div className="space-y-8">
      <PageHeader
        title="Minha conta"
        description="Defina sua senha, atualize seu nome e gerencie segurança."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <IdentidadeCard email={user?.email ?? null} nome={profile?.nome ?? ''} onSaved={refresh} />
        <SenhaCard />
      </div>

      <SegurancaCard onSignOutAll={async () => { await signOut() ; }} />
    </div>
  )
}

/* ============================== Identidade ============================== */

function IdentidadeCard({
  email,
  nome,
  onSaved,
}: {
  email: string | null
  nome: string
  onSaved: () => Promise<void>
}) {
  const { user } = useAuth()
  const [novoNome, setNovoNome] = useState(nome)
  const [novoEmail, setNovoEmail] = useState(email ?? '')
  const [savingNome, setSavingNome] = useState(false)
  const [savingEmail, setSavingEmail] = useState(false)
  const [okMsg, setOkMsg] = useState<string | null>(null)
  const [errMsg, setErrMsg] = useState<string | null>(null)

  async function salvarNome(e: FormEvent) {
    e.preventDefault()
    setOkMsg(null)
    setErrMsg(null)
    if (!user?.id) return
    setSavingNome(true)
    try {
      const { error } = await supabase
        .from('alwayson_user_profiles')
        .update({ nome: novoNome, atualizado_em: new Date().toISOString() })
        .eq('user_id', user.id)
      if (error) throw error
      await supabase.auth.updateUser({ data: { nome: novoNome } })
      await onSaved()
      setOkMsg('Nome atualizado.')
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : 'Falha ao atualizar nome.')
    } finally {
      setSavingNome(false)
    }
  }

  async function pedirTrocaEmail(e: FormEvent) {
    e.preventDefault()
    setOkMsg(null)
    setErrMsg(null)
    if (!novoEmail || novoEmail === email) {
      setErrMsg('Informe um e-mail diferente do atual.')
      return
    }
    setSavingEmail(true)
    try {
      const { error } = await supabase.auth.updateUser({ email: novoEmail.trim() })
      if (error) throw error
      setOkMsg(
        `Enviamos um link de confirmação para ${novoEmail}. Confirme por lá para concluir a troca.`
      )
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : 'Falha ao iniciar troca de e-mail.')
    } finally {
      setSavingEmail(false)
    }
  }

  return (
    <Card eyebrow="Identidade" title="Quem é você">
      <form onSubmit={salvarNome} className="space-y-4">
        <Field id="nome" label="Nome de exibição" icon={<UserIcon className="h-3.5 w-3.5" />}>
          <Input
            id="nome"
            value={novoNome}
            onChange={(e) => setNovoNome(e.target.value)}
            placeholder="Como deseja ser chamado(a)"
            className="h-10 rounded-md border border-foreground/15 bg-card px-3 text-sm shadow-none focus-visible:border-navy focus-visible:ring-0"
          />
        </Field>
        <Button
          type="submit"
          variant="outline"
          size="sm"
          disabled={savingNome || !novoNome.trim() || novoNome.trim() === nome}
          className="text-xs"
        >
          {savingNome ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando
            </>
          ) : (
            'Salvar nome'
          )}
        </Button>
      </form>

      <Hr />

      <form onSubmit={pedirTrocaEmail} className="space-y-4">
        <Field id="email" label="E-mail de acesso" icon={<AtSign className="h-3.5 w-3.5" />}>
          <Input
            id="email"
            type="email"
            value={novoEmail}
            onChange={(e) => setNovoEmail(e.target.value)}
            className="h-10 rounded-md border border-foreground/15 bg-card px-3 text-sm shadow-none focus-visible:border-navy focus-visible:ring-0"
          />
        </Field>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Trocar o e-mail envia um link de confirmação para o novo endereço. O acesso só muda após
          a confirmação.
        </p>
        <Button
          type="submit"
          variant="outline"
          size="sm"
          disabled={savingEmail || !novoEmail || novoEmail === email}
          className="text-xs"
        >
          {savingEmail ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Enviando
            </>
          ) : (
            'Trocar e-mail'
          )}
        </Button>
      </form>

      {(okMsg || errMsg) && <Toast ok={!!okMsg} message={okMsg ?? errMsg ?? ''} />}
    </Card>
  )
}

/* ================================ Senha ================================= */

function SenhaCard() {
  const [senha, setSenha] = useState('')
  const [confirma, setConfirma] = useState('')
  const [showSenha, setShowSenha] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [okMsg, setOkMsg] = useState<string | null>(null)
  const [errMsg, setErrMsg] = useState<string | null>(null)

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setOkMsg(null)
    setErrMsg(null)
    if (senha.length < 8) {
      setErrMsg('A senha precisa ter ao menos 8 caracteres.')
      return
    }
    if (senha !== confirma) {
      setErrMsg('As senhas não coincidem.')
      return
    }
    setSalvando(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: senha })
      if (error) throw error
      setOkMsg('Senha atualizada. Use o novo acesso na próxima entrada.')
      setSenha('')
      setConfirma('')
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : 'Falha ao atualizar a senha.')
    } finally {
      setSalvando(false)
    }
  }

  const score = strength(senha)

  return (
    <Card eyebrow="Senha" title="Defina ou troque sua senha">
      <form onSubmit={salvar} className="space-y-4">
        <Field id="nova-senha" label="Nova senha" icon={<KeyRound className="h-3.5 w-3.5" />}>
          <div className="relative">
            <Input
              id="nova-senha"
              type={showSenha ? 'text' : 'password'}
              required
              autoComplete="new-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="••••••••••"
              className="h-10 rounded-md border border-foreground/15 bg-card px-3 pr-10 text-sm shadow-none focus-visible:border-navy focus-visible:ring-0"
            />
            <button
              type="button"
              onClick={() => setShowSenha((v) => !v)}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground"
              aria-label={showSenha ? 'Ocultar senha' : 'Mostrar senha'}
            >
              {showSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Field>

        <StrengthMeter score={score} />

        <Field id="confirma-senha" label="Confirmar nova senha" icon={<KeyRound className="h-3.5 w-3.5" />}>
          <Input
            id="confirma-senha"
            type={showSenha ? 'text' : 'password'}
            required
            autoComplete="new-password"
            value={confirma}
            onChange={(e) => setConfirma(e.target.value)}
            placeholder="••••••••••"
            className="h-10 rounded-md border border-foreground/15 bg-card px-3 text-sm shadow-none focus-visible:border-navy focus-visible:ring-0"
          />
        </Field>

        <Button
          type="submit"
          size="sm"
          disabled={salvando || !senha || !confirma}
          className="bg-navy text-xs uppercase tracking-[0.16em] text-primary-foreground hover:bg-navy-hover"
        >
          {salvando ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando
            </>
          ) : (
            'Salvar senha'
          )}
        </Button>

        {(okMsg || errMsg) && <Toast ok={!!okMsg} message={okMsg ?? errMsg ?? ''} />}
      </form>
    </Card>
  )
}

function strength(s: string): 0 | 1 | 2 | 3 | 4 {
  if (!s) return 0
  let n = 0
  if (s.length >= 8) n++
  if (s.length >= 12) n++
  if (/[A-Z]/.test(s) && /[a-z]/.test(s)) n++
  if (/\d/.test(s) && /[^A-Za-z0-9]/.test(s)) n++
  return Math.min(n, 4) as 0 | 1 | 2 | 3 | 4
}

function StrengthMeter({ score }: { score: 0 | 1 | 2 | 3 | 4 }) {
  const labels = ['', 'Fraca', 'Razoável', 'Boa', 'Forte']
  const colors = ['bg-foreground/10', 'bg-rose-400', 'bg-amber-400', 'bg-emerald-400', 'bg-emerald-500']
  return (
    <div>
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={`h-1 flex-1 rounded-full ${i <= score ? colors[score] : 'bg-foreground/10'}`}
          />
        ))}
      </div>
      {score > 0 && (
        <p className="mt-1.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          Força · {labels[score]}
        </p>
      )}
    </div>
  )
}

/* ============================== Segurança =============================== */

function SegurancaCard({ onSignOutAll }: { onSignOutAll: () => Promise<void> }) {
  const navigate = useNavigate()
  const [encerrando, setEncerrando] = useState(false)

  async function encerrarTudo() {
    setEncerrando(true)
    try {
      await supabase.auth.signOut({ scope: 'global' })
      await onSignOutAll()
      navigate('/login', { replace: true })
    } finally {
      setEncerrando(false)
    }
  }

  return (
    <Card eyebrow="Segurança" title="Sessões ativas">
      <div className="flex items-start gap-3 rounded-md border border-foreground/10 bg-muted/30 px-4 py-3 text-sm">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-teal" strokeWidth={1.75} />
        <div className="leading-relaxed text-muted-foreground">
          Suas sessões ficam guardadas com segurança no navegador (TLS, escopo multi-tenant). Se
          suspeitar de acesso indevido, encerre todas as sessões agora — você precisará entrar de
          novo em cada dispositivo.
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={encerrando}
        onClick={() => void encerrarTudo()}
        className="border-destructive/30 text-xs text-destructive hover:bg-destructive/10"
      >
        {encerrando ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Encerrando
          </>
        ) : (
          <>
            <LogOut className="h-3.5 w-3.5" /> Encerrar todas as sessões
          </>
        )}
      </Button>
    </Card>
  )
}

/* =============================== shared ================================== */

function Card({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-6 shadow-card">
      <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground editorial-rule">
        {eyebrow}
      </p>
      <h2
        className="mt-2 text-2xl tracking-[-0.01em] text-foreground"
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 380,
          fontVariationSettings: '"opsz" 36, "SOFT" 30',
        }}
      >
        {title}
      </h2>
      <div className="mt-5 space-y-5">{children}</div>
    </section>
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
        className="mb-1.5 inline-flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground transition-colors group-focus-within:text-navy"
      >
        {icon}
        {label}
      </label>
      {children}
    </div>
  )
}

function Toast({ ok, message }: { ok: boolean; message: string }) {
  const Icon = ok ? CheckCircle2 : ShieldAlert
  return (
    <p
      role={ok ? 'status' : 'alert'}
      className={`flex items-start gap-2 border-l-2 px-3 py-2 text-xs leading-relaxed ${
        ok
          ? 'border-emerald-500 bg-emerald-500/5 text-foreground'
          : 'border-destructive bg-destructive/4 text-destructive'
      }`}
    >
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
      <span>{message}</span>
    </p>
  )
}

function Hr() {
  return <div className="my-6 h-px w-full bg-foreground/10" />
}
