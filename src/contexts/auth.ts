import { createContext, useContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'

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

export interface AuthState {
  loading: boolean
  /** True enquanto perfil/tenants são buscados após mudança de sessão (ex.: login) — evita flash "Acesso pendente". */
  resolvingTenants: boolean
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

export const STORAGE_KEY_TENANT = 'alwayson-current-tenant'

/**
 * Context separado do componente provider para garantir Fast Refresh estável
 * em dev: quando o provider e o hook coexistiam em AuthContext.tsx, Vite
 * invalidava o módulo a cada HMR ("useAuth export is incompatible") e gerava
 * contextos paralelos → "useAuth deve ser usado dentro de <AuthProvider>".
 */
export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>')
  return ctx
}
