/**
 * Captura erros de auth que chegam pelo hash da URL (magic link expirado,
 * convite inválido, recovery consumido, etc.), limpa o hash e redireciona
 * para /login com a mensagem armazenada em sessionStorage.
 *
 * Roda antes do React renderizar (importado em main.tsx) para evitar que
 * o supabase-js processe um hash com error=... e a UI fique em estado
 * indefinido (tela branca).
 */

const STORAGE_KEY = 'alwayson-auth-error'

export interface AuthBootstrapError {
  code: string
  description: string
  at: number
}

export function bootstrapAuthErrorFromHash(): void {
  if (typeof window === 'undefined') return
  const hash = window.location.hash
  if (!hash || hash.length < 2) return
  if (!/(^|&|#)error(=|_code=)/.test(hash)) return

  const params = new URLSearchParams(hash.replace(/^#/, ''))
  const code = params.get('error_code') || params.get('error') || 'unknown'
  const description =
    params.get('error_description')?.replaceAll('+', ' ') ?? 'Link inválido ou expirado.'

  const payload: AuthBootstrapError = { code, description, at: Date.now() }
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    /* sessionStorage indisponível (modo privado em alguns browsers) */
  }

  window.history.replaceState({}, '', window.location.pathname + window.location.search)

  if (window.location.pathname !== '/login') {
    window.location.replace('/login')
  }
}

export function consumeAuthError(): AuthBootstrapError | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    window.sessionStorage.removeItem(STORAGE_KEY)
    return JSON.parse(raw) as AuthBootstrapError
  } catch {
    return null
  }
}

export function humanizeAuthError(code: string, fallback?: string): string {
  switch (code) {
    case 'otp_expired':
      return 'O link expirou ou já foi utilizado. Peça um novo abaixo.'
    case 'access_denied':
      return 'Acesso negado. Peça um novo link e tente de novo.'
    case 'invalid_request':
      return 'Link inválido. Solicite um novo abaixo.'
    case 'unauthorized_client':
      return 'Esta URL não está autorizada nas configurações de Auth do projeto.'
    case 'server_error':
      return 'Falha temporária no Supabase Auth. Tente novamente em instantes.'
    default:
      return fallback || 'Não foi possível concluir o acesso. Solicite um novo link.'
  }
}
