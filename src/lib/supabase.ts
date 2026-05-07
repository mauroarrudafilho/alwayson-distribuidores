import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * Namespace o storageKey com o ref do projeto Supabase. Isso evita que uma
 * sessão emitida por um projeto antigo (ex.: ao trocar VITE_SUPABASE_URL no
 * Vercel) seja reaproveitada contra o projeto novo — o que produz 401 com
 * "No suitable key or wrong key type" porque o JWT foi assinado por outro
 * segredo. Trocando o storageKey, o SDK simplesmente não encontra a sessão
 * antiga e começa fresca, mandando o usuário pro /login.
 */
const projectRef = (() => {
  try {
    return new URL(supabaseUrl).hostname.split('.')[0] || 'default'
  } catch {
    return 'default'
  }
})()

const STORAGE_KEY = `alwayson-auth-${projectRef}`

if (typeof window !== 'undefined') {
  // Limpa sessões emitidas por refs anteriores. Não precisamos delas e elas
  // só causam erros 401 contra o ref atual.
  try {
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const key = window.localStorage.key(i)
      if (!key) continue
      if (key === 'alwayson-auth' || (key.startsWith('alwayson-auth-') && key !== STORAGE_KEY)) {
        window.localStorage.removeItem(key)
      }
    }
  } catch {
    // localStorage indisponível (Safari privado, quota etc.) — segue o jogo.
  }
}

/**
 * Lock no-op para o gotrue-js.
 *
 * Em React StrictMode (dev) o AuthProvider monta-desmonta-monta, deixando o
 * lock interno do supabase-js orfão por 5s e provocando loading infinito +
 * "Lock broken by another request with the 'steal' option" no current_user_tenants.
 *
 * O navegador já garante atomicidade de localStorage para um único tab; e
 * coordenação cross-tab dos tokens não é crítica para esta SPA (não fazemos
 * password change concorrente). Para esses cenários o no-op é seguro e é a
 * recomendação oficial do Supabase quando StrictMode está ativo.
 */
const noopLock = async <R>(_name: string, _acquireTimeout: number, fn: () => Promise<R>) => fn()

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: STORAGE_KEY,
    flowType: 'implicit',
    lock: noopLock,
  },
})
