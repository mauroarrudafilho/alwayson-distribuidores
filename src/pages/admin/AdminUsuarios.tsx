import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Building2, ShieldCheck, Users, Mail, Clock, AlertTriangle } from 'lucide-react'
import { PageHeader } from '@/components/distribuidor/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { supabase } from '@/lib/supabase'
import { useAuth, type MembershipRole, type TenantTipo } from '@/contexts/AuthContext'

type ProfileRow = {
  user_id: string
  email: string | null
  nome: string | null
  status: 'active' | 'pending_invite' | 'suspended'
  criado_em: string
}

type TenantEmbed = { nome: string; slug: string; tipo: TenantTipo } | null

type MembershipRow = {
  user_id: string
  role: MembershipRole
  ativo: boolean
  tenant_id: string
  alwayson_tenants: TenantEmbed | TenantEmbed[]
}

type InviteRow = {
  id: string
  email: string
  role: MembershipRole
  status: 'pending' | 'accepted' | 'expired' | 'revoked'
  criado_em: string
  expira_em: string
  alwayson_tenants: TenantEmbed | TenantEmbed[]
}

function unwrapTenant(value: TenantEmbed | TenantEmbed[]): TenantEmbed {
  if (Array.isArray(value)) return value[0] ?? null
  return value
}

const roleLabel: Record<MembershipRole, string> = {
  admin: 'Admin',
  gestor: 'Gestor',
  gestor_cliente: 'Gestor cliente',
  gestor_fornecedor: 'Gestor fornecedor',
  vendedor: 'Vendedor',
  supervisor: 'Supervisor',
  gerente: 'Gerente',
}

const tipoBadge: Record<TenantTipo, { label: string; className: string }> = {
  admin_global: {
    label: 'Admin global',
    className:
      'border-primary/40 bg-primary/10 text-primary dark:border-primary/40 dark:bg-primary/20',
  },
  fornecedor: {
    label: 'Fornecedor',
    className:
      'border-amber-300/60 bg-amber-50 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-100',
  },
  distribuidor: {
    label: 'Distribuidor',
    className:
      'border-emerald-300/60 bg-emerald-50 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-100',
  },
}

export function AdminUsuarios() {
  const { isAdmin } = useAuth()

  const profiles = useQuery({
    enabled: isAdmin,
    queryKey: ['admin', 'usuarios', 'profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('alwayson_user_profiles')
        .select('user_id, email, nome, status, criado_em')
        .order('criado_em', { ascending: false })
      if (error) throw error
      return (data ?? []) as ProfileRow[]
    },
  })

  const memberships = useQuery({
    enabled: isAdmin,
    queryKey: ['admin', 'usuarios', 'memberships'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('alwayson_memberships')
        .select(
          'user_id, role, ativo, tenant_id, alwayson_tenants (nome, slug, tipo)'
        )
        .eq('ativo', true)
      if (error) throw error
      return (data ?? []) as unknown as MembershipRow[]
    },
  })

  const invites = useQuery({
    enabled: isAdmin,
    queryKey: ['admin', 'usuarios', 'invites'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('alwayson_user_invites')
        .select(
          'id, email, role, status, criado_em, expira_em, alwayson_tenants (nome, slug, tipo)'
        )
        .order('criado_em', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as InviteRow[]
    },
  })

  const byUser = useMemo(() => {
    const map = new Map<string, MembershipRow[]>()
    for (const m of memberships.data ?? []) {
      const arr = map.get(m.user_id) ?? []
      arr.push(m)
      map.set(m.user_id, arr)
    }
    return map
  }, [memberships.data])

  if (!isAdmin) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Usuários e organizações"
          description="Visualização de membros, papéis e convites pendentes."
        />
        <Card>
          <CardContent className="flex items-start gap-3 p-4 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p className="text-muted-foreground">
              Apenas administradores globais podem ver esta área.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuários e organizações"
        description="Lista membros e convites pendentes. Convidar / editar / suspender chega na próxima entrega."
      />

      <Card>
        <CardContent className="space-y-3 p-4 text-sm">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Membros ativos</h2>
            <Badge variant="secondary">{profiles.data?.length ?? 0}</Badge>
          </div>

          <div className="overflow-x-auto rounded-lg border border-border/60">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Utilizador</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Vínculos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles.isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={4}>
                        <Skeleton className="h-7 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : (profiles.data ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                      Sem membros ainda — corre <code className="font-mono">npm run admin:bootstrap</code> para
                      criar o primeiro admin.
                    </TableCell>
                  </TableRow>
                ) : (
                  profiles.data!.map((p) => {
                    const ms = byUser.get(p.user_id) ?? []
                    return (
                      <TableRow key={p.user_id}>
                        <TableCell>
                          <span className="text-sm font-medium text-foreground">
                            {p.nome || '—'}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{p.email}</TableCell>
                        <TableCell>
                          <Badge variant={p.status === 'active' ? 'secondary' : 'outline'}>
                            {p.status === 'active'
                              ? 'Ativo'
                              : p.status === 'pending_invite'
                                ? 'Convite pendente'
                                : 'Suspenso'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {ms.length === 0 ? (
                            <span className="text-xs text-muted-foreground">Sem vínculos</span>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {ms.map((m) => {
                                const tenant = unwrapTenant(m.alwayson_tenants)
                                const tipo = tenant?.tipo ?? 'distribuidor'
                                const t = tipoBadge[tipo]
                                return (
                                  <Badge
                                    key={`${m.tenant_id}-${m.role}`}
                                    variant="outline"
                                    className={`gap-1 border ${t.className}`}
                                  >
                                    <Building2 className="h-3 w-3" />
                                    {tenant?.nome || m.tenant_id.slice(0, 6)}
                                    <span className="text-[10px] opacity-80">
                                      · {roleLabel[m.role]}
                                    </span>
                                  </Badge>
                                )
                              })}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-4 text-sm">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Convites</h2>
            <Badge variant="secondary">{invites.data?.length ?? 0}</Badge>
          </div>

          <div className="overflow-x-auto rounded-lg border border-border/60">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Organização</TableHead>
                  <TableHead>Papel</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="whitespace-nowrap">Expira</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invites.isLoading ? (
                  Array.from({ length: 2 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={5}>
                        <Skeleton className="h-7 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : (invites.data ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                      Sem convites pendentes.
                    </TableCell>
                  </TableRow>
                ) : (
                  invites.data!.map((inv) => {
                    const tenant = unwrapTenant(inv.alwayson_tenants)
                    return (
                      <TableRow key={inv.id}>
                        <TableCell className="text-xs">{inv.email}</TableCell>
                        <TableCell>{tenant?.nome || '—'}</TableCell>
                        <TableCell>{roleLabel[inv.role]}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{inv.status}</Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          <Clock className="mr-1 inline h-3 w-3" />
                          {new Date(inv.expira_em).toLocaleDateString('pt-BR')}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-start gap-3 p-4 text-sm">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="space-y-1">
            <p className="font-medium">Próximos passos</p>
            <p className="text-xs text-muted-foreground">
              Convidar/editar/suspender utilizadores e criar tenants por distribuidor entram na
              Fase 2. Por agora, usa <code className="font-mono">npm run admin:bootstrap</code> para
              criar contas com password ou enviar magic link via service role.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
