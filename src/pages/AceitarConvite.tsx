import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, CheckCircle2, Loader2, ShieldAlert } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

type AceiteResult = { ok: true; tenant_id: string; role: string } | { ok: false; error: string }

export function AceitarConvite() {
  const { token } = useParams<{ token: string }>()
  const { session, loading, refresh } = useAuth()
  const navigate = useNavigate()
  const [estado, setEstado] = useState<'idle' | 'aceitando' | 'erro' | 'ok'>('idle')
  const [mensagem, setMensagem] = useState<string | null>(null)

  useEffect(() => {
    if (loading) return
    if (!session) return
    if (!token) {
      setEstado('erro')
      setMensagem('Link de convite inválido.')
      return
    }
    let cancelled = false
    ;(async () => {
      setEstado('aceitando')
      const { data, error } = await supabase.rpc('alwayson_accept_invite', { p_token: token })
      if (cancelled) return
      if (error) {
        setEstado('erro')
        setMensagem(error.message)
        return
      }
      const payload = data as AceiteResult
      if (!payload?.ok) {
        setEstado('erro')
        const code = payload?.error ?? 'desconhecido'
        const human: Record<string, string> = {
          token_invalido: 'Convite não encontrado.',
          convite_ja_utilizado_ou_revogado: 'Este convite já foi utilizado ou foi revogado.',
          convite_expirado: 'O convite expirou. Solicite um novo ao administrador.',
          email_nao_corresponde: 'O e-mail do seu acesso não confere com o do convite.',
          nao_autenticado: 'Você precisa entrar na sua conta antes de aceitar o convite.',
        }
        setMensagem(human[code] ?? `Falha: ${code}`)
        return
      }
      await refresh()
      setEstado('ok')
      setMensagem('Tudo certo! Seu acesso foi liberado.')
      setTimeout(() => navigate('/', { replace: true }), 1400)
    })()
    return () => {
      cancelled = true
    }
  }, [loading, session, token, refresh, navigate])

  if (loading) return null

  if (!session) {
    return (
      <Shell eyebrow="Convite recebido" title="Falta só" italic="entrar.">
        <p className="mt-4 max-w-[36ch] text-sm leading-relaxed text-muted-foreground">
          Para aceitar o convite, entre na sua conta com o mesmo e-mail que recebeu a mensagem.
        </p>
        <Link
          to={`/login?next=${encodeURIComponent(`/aceitar-convite/${token ?? ''}`)}`}
          className="group mt-8 inline-flex h-12 items-center gap-3 rounded-full bg-navy px-6 text-[13px] font-medium uppercase tracking-[0.18em] text-primary-foreground transition-colors hover:bg-navy-hover"
        >
          Ir para o login
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" strokeWidth={1.75} />
        </Link>
      </Shell>
    )
  }

  return (
    <Shell
      eyebrow="Aceitar convite"
      title={estado === 'ok' ? 'Bem-vindo' : estado === 'erro' ? 'Não foi possível' : 'Quase lá'}
      italic={estado === 'ok' ? 'à plataforma.' : estado === 'erro' ? 'aceitar.' : 'aceitando…'}
    >
      <div className="mt-8 flex items-start gap-3 border-l-2 px-5 py-4 text-sm"
        style={{
          borderColor:
            estado === 'ok'
              ? 'oklch(0.65 0.17 145)'
              : estado === 'erro'
                ? 'var(--destructive)'
                : 'var(--teal)',
          background:
            estado === 'ok'
              ? 'oklch(0.65 0.17 145 / 0.06)'
              : estado === 'erro'
                ? 'oklch(0.55 0.22 25 / 0.05)'
                : 'oklch(0.70 0.15 175 / 0.05)',
        }}
      >
        {estado === 'aceitando' || estado === 'idle' ? (
          <Loader2 className="mt-0.5 h-4 w-4 animate-spin text-teal" strokeWidth={1.75} />
        ) : estado === 'ok' ? (
          <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" strokeWidth={1.75} />
        ) : (
          <ShieldAlert className="mt-0.5 h-4 w-4 text-destructive" strokeWidth={1.75} />
        )}
        <div className="text-muted-foreground leading-relaxed">
          {estado === 'aceitando' && 'Estamos validando seu convite e atribuindo o acesso correto.'}
          {estado === 'idle' && 'Iniciando…'}
          {(estado === 'ok' || estado === 'erro') && mensagem}
        </div>
      </div>

      {estado === 'erro' && (
        <Link
          to="/"
          className="mt-6 inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-navy hover:underline"
        >
          Voltar para o início
        </Link>
      )}
    </Shell>
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
