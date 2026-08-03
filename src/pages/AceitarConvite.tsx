import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, CheckCircle2, Loader2, ShieldAlert } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { AuthShell } from '@/components/auth/AuthShell'
import { DefinirSenhaForm } from '@/components/auth/DefinirSenhaForm'
import { useAuth } from '@/contexts/auth'
import {
  clearAuthHash,
  getAuthHashType,
  userNeedsPasswordSetup,
} from '@/lib/auth-callback'
import { useAuthCallbackSession } from '@/hooks/useAuthCallbackSession'

type AceiteResult = { ok: true; tenant_id: string; role: string } | { ok: false; error: string }

type Fase = 'aguardando' | 'senha' | 'aceitando' | 'erro' | 'ok'

export function AceitarConvite() {
  const { token } = useParams<{ token: string }>()
  const { session, loading, refresh } = useAuth()
  const navigate = useNavigate()
  const { resolvingCallback, authFlowType } = useAuthCallbackSession(loading, session)
  const [fase, setFase] = useState<Fase>('aguardando')
  const [mensagem, setMensagem] = useState<string | null>(null)
  const aceiteIniciado = useRef(false)

  const precisaSenha =
    session &&
    (authFlowType === 'invite' ||
      getAuthHashType() === 'invite' ||
      userNeedsPasswordSetup(session.user.user_metadata as Record<string, unknown> | undefined))

  const aceitarConvite = useCallback(async () => {
    if (!token) {
      setFase('erro')
      setMensagem('Link de convite inválido.')
      return
    }
    setFase('aceitando')
    const { data, error } = await supabase.rpc('alwayson_accept_invite', { p_token: token })
    if (error) {
      setFase('erro')
      setMensagem(error.message)
      return
    }
    const payload = data as AceiteResult
    if (!payload?.ok) {
      setFase('erro')
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
    clearAuthHash()
    setFase('ok')
    setMensagem('Tudo certo! Seu acesso foi liberado.')
    setTimeout(() => navigate('/', { replace: true }), 1400)
  }, [token, refresh, navigate])

  useEffect(() => {
    if (loading || resolvingCallback) return
    if (!session) return
    if (!token) {
      setFase('erro')
      setMensagem('Link de convite inválido.')
      return
    }
    if (precisaSenha) {
      setFase('senha')
      return
    }
    if (aceiteIniciado.current) return
    aceiteIniciado.current = true
    void aceitarConvite()
  }, [loading, resolvingCallback, session, token, precisaSenha, aceitarConvite])

  async function handleDefinirSenha(password: string) {
    const { error } = await supabase.auth.updateUser({
      password,
      data: { needs_password_setup: false },
    })
    if (error) throw error
    clearAuthHash()
    aceiteIniciado.current = true
    await aceitarConvite()
  }

  if (loading || resolvingCallback) {
    return (
      <AuthShell eyebrow="Aceitar convite" title="Verificando" italic="seu convite…">
        <p className="mt-6 inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border border-foreground/30 border-t-navy" />
          Validando link seguro
        </p>
      </AuthShell>
    )
  }

  if (!session) {
    return (
      <AuthShell eyebrow="Convite recebido" title="Falta só" italic="entrar.">
        <p className="mt-4 max-w-[36ch] text-sm leading-relaxed text-muted-foreground">
          Para aceitar o convite, entre na sua conta com o mesmo e-mail que recebeu a mensagem — ou
          use o link do e-mail de convite que cria o acesso automaticamente.
        </p>
        <Link
          to={`/login?next=${encodeURIComponent(`/aceitar-convite/${token ?? ''}`)}`}
          className="group mt-8 inline-flex h-12 items-center gap-3 rounded-full bg-navy px-6 text-[13px] font-medium uppercase tracking-[0.18em] text-primary-foreground transition-colors hover:bg-navy-hover"
        >
          Ir para o login
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" strokeWidth={1.75} />
        </Link>
        <Link
          to="/recuperar-password"
          className="mt-4 block text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
        >
          Já aceitou o convite? Defina ou recupere sua senha
        </Link>
      </AuthShell>
    )
  }

  if (fase === 'senha') {
    return (
      <AuthShell eyebrow="Aceitar convite" title="Crie sua" italic="senha.">
        <p className="mt-4 max-w-[36ch] text-sm leading-relaxed text-muted-foreground">
          Quase lá — escolha uma senha para proteger seu acesso antes de liberarmos o convite.
        </p>
        <DefinirSenhaForm
          submitLabel="Aceitar convite"
          submittingLabel="Salvando"
          onSubmit={handleDefinirSenha}
        />
      </AuthShell>
    )
  }

  return (
    <AuthShell
      eyebrow="Aceitar convite"
      title={fase === 'ok' ? 'Bem-vindo' : fase === 'erro' ? 'Não foi possível' : 'Quase lá'}
      italic={fase === 'ok' ? 'à plataforma.' : fase === 'erro' ? 'aceitar.' : 'aceitando…'}
    >
      <div
        className="mt-8 flex items-start gap-3 border-l-2 px-5 py-4 text-sm"
        style={{
          borderColor:
            fase === 'ok'
              ? 'oklch(0.65 0.17 145)'
              : fase === 'erro'
                ? 'var(--destructive)'
                : 'var(--teal)',
          background:
            fase === 'ok'
              ? 'oklch(0.65 0.17 145 / 0.06)'
              : fase === 'erro'
                ? 'oklch(0.55 0.22 25 / 0.05)'
                : 'oklch(0.70 0.15 175 / 0.05)',
        }}
      >
        {fase === 'aceitando' || fase === 'aguardando' ? (
          <Loader2 className="mt-0.5 h-4 w-4 animate-spin text-teal" strokeWidth={1.75} />
        ) : fase === 'ok' ? (
          <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" strokeWidth={1.75} />
        ) : (
          <ShieldAlert className="mt-0.5 h-4 w-4 text-destructive" strokeWidth={1.75} />
        )}
        <div className="leading-relaxed text-muted-foreground">
          {fase === 'aceitando' && 'Estamos validando seu convite e atribuindo o acesso correto.'}
          {fase === 'aguardando' && 'Iniciando…'}
          {(fase === 'ok' || fase === 'erro') && mensagem}
        </div>
      </div>

      {fase === 'erro' && (
        <div className="mt-6 space-y-3">
          {mensagem?.includes('já foi utilizado') && (
            <Link
              to="/recuperar-password"
              className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-navy hover:underline"
            >
              Definir ou recuperar senha
            </Link>
          )}
          <Link
            to="/"
            className="block text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
          >
            Voltar para o início
          </Link>
        </div>
      )}
    </AuthShell>
  )
}
