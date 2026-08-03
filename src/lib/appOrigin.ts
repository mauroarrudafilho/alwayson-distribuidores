/** Origem pública da app — usada em convites e redirects Auth. */
export function getAppOrigin(): string {
  const configured = import.meta.env.VITE_APP_URL?.trim().replace(/\/$/, '')
  if (configured) return configured
  if (typeof window !== 'undefined') {
    return window.location.origin.replace(/\/$/, '')
  }
  return ''
}
