import type { MembershipRole } from '@/contexts/auth'

export type InviteMembershipSpec = {
  tenant_id: string
  role: MembershipRole
}

const FORNECEDOR_ROLES: MembershipRole[] = ['gestor_fornecedor', 'kam']
const DISTRIBUIDOR_ROLES: MembershipRole[] = [
  'gestor',
  'gestor_cliente',
  'vendedor',
  'supervisor',
  'gerente',
  'kam',
]

export function rolePrecisaFornecedor(role: MembershipRole): boolean {
  return FORNECEDOR_ROLES.includes(role)
}

export function rolePrecisaDistribuidor(role: MembershipRole): boolean {
  return DISTRIBUIDOR_ROLES.includes(role)
}

export function roleEhAdminGlobal(role: MembershipRole): boolean {
  return role === 'admin'
}

export function buildInviteMemberships(
  role: MembershipRole,
  fornecedorTenantIds: string[],
  distribuidorTenantIds: string[],
  adminGlobalTenantId: string | null,
): InviteMembershipSpec[] {
  if (roleEhAdminGlobal(role)) {
    if (!adminGlobalTenantId) return []
    return [{ tenant_id: adminGlobalTenantId, role: 'admin' }]
  }

  const specs: InviteMembershipSpec[] = []
  for (const tenant_id of fornecedorTenantIds) {
    if (rolePrecisaFornecedor(role)) specs.push({ tenant_id, role })
  }
  for (const tenant_id of distribuidorTenantIds) {
    if (rolePrecisaDistribuidor(role)) specs.push({ tenant_id, role })
  }
  return specs
}

export function validarConviteAcesso(
  role: MembershipRole,
  fornecedorTenantIds: string[],
  distribuidorTenantIds: string[],
  adminGlobalTenantId: string | null,
): string | null {
  if (roleEhAdminGlobal(role)) {
    return adminGlobalTenantId ? null : 'Tenant admin global não encontrado.'
  }
  if (rolePrecisaFornecedor(role) && fornecedorTenantIds.length === 0) {
    return 'Selecione pelo menos um fornecedor.'
  }
  if (rolePrecisaDistribuidor(role) && distribuidorTenantIds.length === 0) {
    return 'Selecione pelo menos um distribuidor parceiro.'
  }
  if (role === 'kam' && (fornecedorTenantIds.length === 0 || distribuidorTenantIds.length === 0)) {
    return 'KAM precisa de fornecedor e distribuidor — o acesso é a interseção dos dois.'
  }
  return null
}

export function resumoVinculosConvite(
  role: MembershipRole,
  fornecedorNomes: string[],
  distribuidorNomes: string[],
): string {
  if (roleEhAdminGlobal(role)) return 'Admin global (DevTech Labs)'
  const partes: string[] = []
  if (fornecedorNomes.length) partes.push(`Fornecedor: ${fornecedorNomes.join(', ')}`)
  if (distribuidorNomes.length) partes.push(`Parceiro: ${distribuidorNomes.join(', ')}`)
  return partes.length ? `${partes.join(' · ')} (${roleLabelShort(role)})` : roleLabelShort(role)
}

function roleLabelShort(role: MembershipRole): string {
  const labels: Record<MembershipRole, string> = {
    admin: 'Admin',
    gestor: 'Gestor',
    gestor_cliente: 'Gestor cliente',
    gestor_fornecedor: 'Gestor fornecedor',
    kam: 'KAM',
    vendedor: 'Vendedor',
    supervisor: 'Supervisor',
    gerente: 'Gerente',
  }
  return labels[role]
}
