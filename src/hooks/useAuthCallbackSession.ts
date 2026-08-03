import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { getAuthHashType, hashHasAuthTokens } from '@/lib/auth-callback'

/**
 * Aguarda o supabase-js consumir tokens do hash (#access_token=…) antes de
 * concluir que não há sessão — evita falso "link expirado" em recovery/convite.
 */
export function useAuthCallbackSession(loading: boolean, session: Session | null) {
  const [resolvingCallback, setResolvingCallback] = useState(() => hashHasAuthTokens())
  const authFlowType = getAuthHashType()

  useEffect(() => {
    if (!hashHasAuthTokens()) {
      setResolvingCallback(false)
      return
    }

    if (session) {
      setResolvingCallback(false)
      return
    }

    if (loading) return

    let cancelled = false
    const timeout = window.setTimeout(() => {
      if (!cancelled) setResolvingCallback(false)
    }, 8000)

    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (
        newSession &&
        (event === 'SIGNED_IN' ||
          event === 'PASSWORD_RECOVERY' ||
          event === 'INITIAL_SESSION' ||
          event === 'USER_UPDATED')
      ) {
        if (!cancelled) setResolvingCallback(false)
      }
    })

    void supabase.auth.getSession().then(({ data }) => {
      if (!cancelled && data.session) setResolvingCallback(false)
    })

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
      sub.subscription.unsubscribe()
    }
  }, [loading, session])

  return { resolvingCallback, authFlowType }
}
