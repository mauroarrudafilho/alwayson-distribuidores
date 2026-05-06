import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { buttonVariants } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'

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
          convite_expirado: 'O convite expirou. Pede um novo ao admin.',
          email_nao_corresponde: 'O email do teu acesso não bate com o do convite.',
          nao_autenticado: 'É preciso entrar na conta antes de aceitar o convite.',
        }
        setMensagem(human[code] ?? `Falha: ${code}`)
        return
      }
      await refresh()
      setEstado('ok')
      setMensagem('Bem-vindo! O acesso foi liberado.')
      setTimeout(() => navigate('/', { replace: true }), 1200)
    })()
    return () => {
      cancelled = true
    }
  }, [loading, session, token, refresh, navigate])

  if (loading) return null
  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm space-y-3 text-center">
          <h1 className="text-lg font-semibold text-foreground">Aceitar convite</h1>
          <p className="text-sm text-muted-foreground">
            Para continuar, entra na conta com o email do convite.
          </p>
          <Link
            to={`/login?next=${encodeURIComponent(`/aceitar-convite/${token ?? ''}`)}`}
            className={cn(buttonVariants({ size: 'lg' }), 'w-full')}
          >
            Ir para o login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-sm space-y-3 text-center">
        <h1 className="text-lg font-semibold text-foreground">
          {estado === 'ok' ? 'Convite aceite' : 'Convite'}
        </h1>
        <p className="text-sm text-muted-foreground">
          {estado === 'aceitando' && 'A processar o teu convite…'}
          {estado === 'idle' && 'Iniciando…'}
          {mensagem}
        </p>
        {estado === 'erro' && (
          <Link to="/" className={cn(buttonVariants({ variant: 'outline' }))}>
            Voltar ao início
          </Link>
        )}
      </div>
    </div>
  )
}
