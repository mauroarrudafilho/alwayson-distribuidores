import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, CheckCircle2, Loader2, ShieldAlert } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { AuthShell } from '@/components/auth/AuthShell'
import { useAuth } from '@/contexts/auth'

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

  if (loading) {
    return (
      <AuthShell eyebrow="Aceitar convite" title="Verificando" italic="seu convite…">
        <p className="mt-6 inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border border-foreground/30 border-t-navy" />
          Carregando sessão
        </p>
      </AuthShell>
    )
  }

  if (!session) {
    return (
      <AuthShell eyebrow="Convite recebido" title="Falta só" italic="entrar.">
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
      </AuthShell>
    )
  }

  return (
    <AuthShell
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
    </AuthShell>
  )
}
