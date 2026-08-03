/** Utilitários para links de convite, recovery e magic link (hash #access_token=…). */

export function getAuthHashParams(): URLSearchParams | null {
  if (typeof window === 'undefined') return null
  const hash = window.location.hash.replace(/^#/, '')
  if (!hash) return null
  return new URLSearchParams(hash)
}

export function getAuthHashType(): string | null {
  return getAuthHashParams()?.get('type') ?? null
}

export function hashHasAuthTokens(): boolean {
  if (typeof window === 'undefined') return false
  const hash = window.location.hash
  return hash.includes('access_token=') || hash.includes('error=')
}

export function clearAuthHash(): void {
  if (typeof window === 'undefined') return
  window.history.replaceState({}, '', window.location.pathname + window.location.search)
}

export function userNeedsPasswordSetup(metadata: Record<string, unknown> | undefined): boolean {
  return metadata?.needs_password_setup === true
}

export function redefinirPasswordPath(next?: string, flow?: 'invite'): string {
  const params = new URLSearchParams()
  if (next) params.set('next', next)
  if (flow) params.set('flow', flow)
  const q = params.toString()
  return `/redefinir-password${q ? `?${q}` : ''}`
}
