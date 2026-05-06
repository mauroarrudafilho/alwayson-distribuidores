import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export type TenantTipo = 'admin_global' | 'fornecedor' | 'distribuidor'

export type MembershipRole =
  | 'admin'
  | 'gestor'
  | 'gestor_cliente'
  | 'gestor_fornecedor'
  | 'vendedor'
  | 'supervisor'
  | 'gerente'

export interface UserProfile {
  user_id: string
  email: string | null
  nome: string | null
  status: 'active' | 'pending_invite' | 'suspended'
}

export interface TenantMembership {
  tenant_id: string
  tipo: TenantTipo
  nome: string
  slug: string
  role: MembershipRole
  escopo: Record<string, unknown>
}

interface AuthState {
  loading: boolean
  session: Session | null
  user: User | null
  profile: UserProfile | null
  memberships: TenantMembership[]
  currentTenant: TenantMembership | null
  isAdmin: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  setCurrentTenantById: (tenantId: string) => void
  refresh: () => Promise<void>
}

const STORAGE_KEY_TENANT = 'alwayson-current-tenant'

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [memberships, setMemberships] = useState<TenantMembership[]>([])
  const [currentTenantId, setCurrentTenantId] = useState<string | null>(() =>
    typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY_TENANT) : null
  )
  const [loading, setLoading] = useState(true)

  const loadingRef = useRef(false)

  const loadProfileAndTenants = useCallback(async (userId: string) => {
    if (loadingRef.current) return
    loadingRef.current = true
    try {
      const [profileRes, tenantsRes] = await Promise.all([
        supabase
          .from('alwayson_user_profiles')
          .select('user_id, email, nome, status')
          .eq('user_id', userId)
          .maybeSingle(),
        supabase.rpc('current_user_tenants'),
      ])

      if (profileRes.error) {
        console.error('Profile load:', profileRes.error.message)
        setProfile(null)
      } else {
        setProfile((profileRes.data as UserProfile | null) ?? null)
      }

      if (tenantsRes.error) {
        console.error('Tenants load:', tenantsRes.error.message)
        setMemberships([])
      } else {
        const list = (tenantsRes.data ?? []) as TenantMembership[]
        setMemberships(list)
        if (list.length > 0) {
          setCurrentTenantId((prev) => {
            if (prev && list.some((t) => t.tenant_id === prev)) return prev
            const next = list[0].tenant_id
            if (typeof window !== 'undefined')
              window.localStorage.setItem(STORAGE_KEY_TENANT, next)
            return next
          })
        }
      }
    } finally {
      loadingRef.current = false
    }
  }, [])

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    setSession(data.session)
    if (data.session?.user) {
      await loadProfileAndTenants(data.session.user.id)
    } else {
      setProfile(null)
      setMemberships([])
      setCurrentTenantId(null)
    }
  }, [loadProfileAndTenants])

  useEffect(() => {
    let mounted = true
    setLoading(true)
    refresh().finally(() => {
      if (mounted) setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession)
      if (newSession?.user) {
        await loadProfileAndTenants(newSession.user.id)
      } else {
        setProfile(null)
        setMemberships([])
        setCurrentTenantId(null)
        if (typeof window !== 'undefined')
          window.localStorage.removeItem(STORAGE_KEY_TENANT)
      }
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [loadProfileAndTenants, refresh])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) throw error
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const setCurrentTenantById = useCallback((tenantId: string) => {
    setCurrentTenantId(tenantId)
    if (typeof window !== 'undefined')
      window.localStorage.setItem(STORAGE_KEY_TENANT, tenantId)
  }, [])

  const currentTenant = useMemo(
    () => memberships.find((m) => m.tenant_id === currentTenantId) ?? memberships[0] ?? null,
    [memberships, currentTenantId]
  )

  const isAdmin = useMemo(
    () => memberships.some((m) => m.tipo === 'admin_global' && m.role === 'admin'),
    [memberships]
  )

  const value = useMemo<AuthState>(
    () => ({
      loading,
      session,
      user: session?.user ?? null,
      profile,
      memberships,
      currentTenant,
      isAdmin,
      signIn,
      signOut,
      setCurrentTenantById,
      refresh,
    }),
    [
      loading,
      session,
      profile,
      memberships,
      currentTenant,
      isAdmin,
      signIn,
      signOut,
      setCurrentTenantById,
      refresh,
    ]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>')
  return ctx
}
