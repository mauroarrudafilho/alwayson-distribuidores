import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

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
    storageKey: 'alwayson-auth',
    flowType: 'implicit',
    lock: noopLock,
  },
})
