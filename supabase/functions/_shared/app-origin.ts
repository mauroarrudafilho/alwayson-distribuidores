const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://mesh-sales-platform.vercel.app',
]

export function canonicalAppOrigin(): string {
  return (Deno.env.get('APP_PUBLIC_URL') ?? '').trim().replace(/\/$/, '')
}

function parseAllowedOrigins(): string[] {
  const extra = (Deno.env.get('ALLOWED_APP_ORIGINS') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const merged = [...DEFAULT_ALLOWED_ORIGINS, ...extra]
  const canonical = canonicalAppOrigin()
  if (canonical) merged.push(canonical)
  return [...new Set(merged)]
}

/** Origem da app para links em e-mail — convites usam produção quando admin está em localhost. */
export function resolveAppOrigin(requestedOrigin: string):
  | { ok: true; origin: string }
  | { ok: false; error: string; message: string } {
  const allowed = parseAllowedOrigins()
  const canonical = canonicalAppOrigin()
  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(requestedOrigin)

  if (isLocal && canonical && allowed.includes(canonical)) {
    return { ok: true, origin: canonical }
  }

  if (requestedOrigin && allowed.includes(requestedOrigin)) {
    return { ok: true, origin: requestedOrigin }
  }

  if (canonical && allowed.includes(canonical)) {
    return { ok: true, origin: canonical }
  }

  return {
    ok: false,
    error: 'origin_nao_autorizada',
    message: 'app_origin deve ser a origem exata da aplicação e estar na lista permitida.',
  }
}
