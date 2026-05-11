import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Building2,
  ShieldCheck,
  Users,
  Mail,
  Clock,
  AlertTriangle,
  UserPlus,
  MoreHorizontal,
  Pencil,
  Ban,
  CheckCircle,
  BriefcaseBusiness,
  Link2,
  Copy,
  XCircle,
} from 'lucide-react'
import { PageHeader } from '@/components/distribuidor/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { supabase } from '@/lib/supabase'
import { useAuth, type MembershipRole, type TenantTipo } from '@/contexts/auth'
import { useDistribuidores } from '@/hooks/useDistribuidores'
import { cn } from '@/lib/utils'

type ProfileRow = {
  user_id: string
  email: string | null
  nome: string | null
  status: 'active' | 'pending_invite' | 'suspended'
  criado_em: string
}

type TenantEmbed = { nome: string; slug: string; tipo: TenantTipo } | null

type MembershipRow = {
  id: string
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

type TenantRow = {
  id: string
  nome: string
  slug: string
  tipo: TenantTipo
  distribuidor_id: string | null
  ativo: boolean
}

type InviteFnResponse =
  | {
      ok: true
      delivery: 'signup_email' | 'magiclink'
      invite_id: string
      message?: string
      action_link?: string
    }
  | {
      ok: false
      error: string
      message?: string
      invite_id?: string
      hint?: string
    }

function unwrapTenant(value: TenantEmbed | TenantEmbed[]): TenantEmbed {
  if (Array.isArray(value)) return value[0] ?? null
  return value
}

function slugifyDistribuidor(nome: string): string {
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 42)
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

const ROLE_OPTIONS = Object.entries(roleLabel) as [MembershipRole, string][]

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

function TenantRoleBadge({
  tipo,
}: {
  tipo: TenantTipo
}) {
  const t = tipoBadge[tipo]
  return (
    <Badge variant="outline" className={cn('text-[10px] font-normal', t.className)}>
      {t.label}
    </Badge>
  )
}

export function AdminUsuarios() {
  const qc = useQueryClient()
  const { isAdmin, session, refresh } = useAuth()
  const currentUserId = session?.user?.id ?? ''

  const [inviteOpen, setInviteOpen] = useState(false)
  const [tenantOpen, setTenantOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteNome, setInviteNome] = useState('')
  const [inviteTenantId, setInviteTenantId] = useState('')
  const [inviteRole, setInviteRole] = useState<MembershipRole>('gestor')
  const [magicLinkShown, setMagicLinkShown] = useState('')
  const [inviteError, setInviteError] = useState<string | null>(null)

  const [editNomeOpen, setEditNomeOpen] = useState(false)
  const [editNomeUserId, setEditNomeUserId] = useState<string | null>(null)
  const [editNomeValor, setEditNomeValor] = useState('')
  const [membershipsOpen, setMembershipsOpen] = useState(false)
  const [membershipsUserId, setMembershipsUserId] = useState<string | null>(null)
  const [newMbTenantId, setNewMbTenantId] = useState('')
  const [newMbRole, setNewMbRole] = useState<MembershipRole>('gestor')
  const [createTenantDistribuidorId, setCreateTenantDistribuidorId] = useState('')

  const { data: distribuidores = [] } = useDistribuidores()

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

  const tenants = useQuery({
    enabled: isAdmin,
    queryKey: ['admin', 'usuarios', 'tenants'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('alwayson_tenants')
        .select('id, nome, slug, tipo, distribuidor_id, ativo')
        .order('tipo', { ascending: true })
        .order('nome', { ascending: true })
      if (error) throw error
      return (data ?? []) as TenantRow[]
    },
  })

  const memberships = useQuery({
    enabled: isAdmin,
    queryKey: ['admin', 'usuarios', 'memberships'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('alwayson_memberships')
        .select(
          'id, user_id, role, ativo, tenant_id, alwayson_tenants (nome, slug, tipo)',
        )
        .eq('ativo', true)
      if (error) throw error
      return (data ?? []) as unknown as MembershipRow[]
    },
  })

  /** Inclui membros desativados para o diálogo de gestão — query separada. */
  const allMemberships = useQuery({
    enabled: isAdmin && Boolean(membershipsUserId),
    queryKey: ['admin', 'usuarios', 'memberships-all', membershipsUserId],
    queryFn: async () => {
      if (!membershipsUserId) return []
      const { data, error } = await supabase
        .from('alwayson_memberships')
        .select(
          'id, user_id, role, ativo, tenant_id, alwayson_tenants (nome, slug, tipo)',
        )
        .eq('user_id', membershipsUserId)
        .order('criado_em', { ascending: true })
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
          'id, email, role, status, criado_em, expira_em, alwayson_tenants (nome, slug, tipo)',
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

  const distribuidoresSemTenant = useMemo(() => {
    const used = new Set(
      (tenants.data ?? []).map((t) => t.distribuidor_id).filter(Boolean) as string[],
    )
    return distribuidores.filter((d) => !used.has(d.id))
  }, [tenants.data, distribuidores])

  const membershipsTargetProfile = useMemo(
    () => profiles.data?.find((p) => p.user_id === membershipsUserId) ?? null,
    [profiles.data, membershipsUserId],
  )

  const sendInvite = useMutation({
    mutationFn: async () => {
      setInviteError(null)
      setMagicLinkShown('')
      const origin = typeof window !== 'undefined' ? window.location.origin.replace(/\/$/, '') : ''
      const { data, error } = await supabase.functions.invoke('admin-invite-user', {
        body: {
          email: inviteEmail.trim(),
          nome: inviteNome.trim() || undefined,
          tenant_id: inviteTenantId,
          role: inviteRole,
          app_origin: origin,
        },
      })
      if (error) throw new Error(error.message)
      const payload = data as InviteFnResponse | null
      if (!payload) throw new Error('Resposta vazia da função.')
      if (!payload.ok) {
        const msg =
          typeof payload.message === 'string'
            ? payload.message
            : payload.error ?? 'invite_failed'
        const extra = payload.hint ? ` ${payload.hint}` : ''
        throw new Error(`${msg}${extra}`)
      }
      return payload
    },
    onSuccess: async (payload) => {
      setInviteError(null)
      await qc.invalidateQueries({ queryKey: ['admin', 'usuarios', 'invites'] })
      await refresh()
      if (payload.delivery === 'magiclink' && payload.action_link) {
        setMagicLinkShown(payload.action_link)
      } else {
        setInviteOpen(false)
        setInviteEmail('')
        setInviteNome('')
      }
    },
    onError: (e: unknown) => {
      setInviteError(e instanceof Error ? e.message : 'Erro ao convidar.')
    },
  })

  const revokeInvite = useMutation({
    mutationFn: async (inviteId: string) => {
      const { error } = await supabase
        .from('alwayson_user_invites')
        .update({ status: 'revoked' })
        .eq('id', inviteId)
        .eq('status', 'pending')
      if (error) throw error
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['admin', 'usuarios', 'invites'] })
    },
  })

  const updateProfile = useMutation({
    mutationFn: async ({
      userId,
      nome,
      status,
    }: {
      userId: string
      nome?: string
      status?: ProfileRow['status']
    }) => {
      const patch: Partial<Pick<ProfileRow, 'nome' | 'status'>> & { atualizado_em: string } = {
        atualizado_em: new Date().toISOString(),
      }
      if (nome !== undefined) patch.nome = nome || null
      if (status !== undefined) patch.status = status

      const { error } = await supabase.from('alwayson_user_profiles').update(patch).eq('user_id', userId)
      if (error) throw error
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['admin', 'usuarios'] })
      await refresh()
      setEditNomeOpen(false)
      setEditNomeUserId(null)
    },
  })

  const createDistribuidorTenant = useMutation({
    mutationFn: async (distId: string) => {
      const dist = distribuidores.find((d) => d.id === distId)
      if (!dist) throw new Error('Distribuidor não encontrado.')
      let base = slugifyDistribuidor(dist.nome || 'tenant')
      if (!base) base = 'distribuidor'
      let slug = base
      for (let n = 0; n < 25; n++) {
        const { data: clash } = await supabase.from('alwayson_tenants').select('id').eq('slug', slug).maybeSingle()
        if (!clash) break
        slug = `${base}-${n + 1}`
      }
      const { error } = await supabase.from('alwayson_tenants').insert({
        tipo: 'distribuidor',
        nome: dist.nome,
        slug,
        distribuidor_id: dist.id,
        ativo: true,
      })
      if (error) throw error
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['admin', 'usuarios'] })
      setTenantOpen(false)
      setCreateTenantDistribuidorId('')
    },
  })

  const updateMembership = useMutation({
    mutationFn: async (row: Pick<MembershipRow, 'id' | 'role' | 'ativo'>) => {
      const { error } = await supabase
        .from('alwayson_memberships')
        .update({ role: row.role, ativo: row.ativo })
        .eq('id', row.id)
      if (error) throw error
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['admin', 'usuarios'] })
      await allMemberships.refetch()
      await refresh()
    },
  })

  const deleteMembership = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('alwayson_memberships').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['admin', 'usuarios'] })
      await allMemberships.refetch()
      await refresh()
    },
  })

  const addMembership = useMutation({
    mutationFn: async ({
      userId,
      tenantId,
      role,
    }: {
      userId: string
      tenantId: string
      role: MembershipRole
    }) => {
      const { error } = await supabase.from('alwayson_memberships').insert({
        user_id: userId,
        tenant_id: tenantId,
        role,
        ativo: true,
        aceito_em: new Date().toISOString(),
      })
      if (error) throw error
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['admin', 'usuarios'] })
      await allMemberships.refetch()
      setNewMbTenantId('')
      await refresh()
    },
  })

  const openInvite = () => {
    setInviteError(null)
    setMagicLinkShown('')
    const first = tenants.data?.[0]?.id ?? ''
    setInviteTenantId((prev) => prev || first)
    setInviteOpen(true)
  }

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
        description="Convide por e-mail, crie tenants por distribuidor, edite nomes, suspenda contas e ajuste vínculos."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setTenantOpen(true)}>
              <BriefcaseBusiness className="mr-1.5 h-3.5 w-3.5" />
              Novo tenant (distribuidor)
            </Button>
            <Button type="button" size="sm" onClick={openInvite}>
              <UserPlus className="mr-1.5 h-3.5 w-3.5" />
              Convidar utilizador
            </Button>
          </div>
        }
      />

      {inviteError && !inviteOpen && (
        <p className="text-xs text-destructive">{inviteError}</p>
      )}

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Convidar utilizador</DialogTitle>
            <DialogDescription>
              Envia e-mail via Supabase Auth com retorno para aceitar o convite nesta app. Se o e-mail
              já tiver conta, é gerado um link mágico para copiar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {magicLinkShown ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Copie o link e envie ao utilizador (ex.: WhatsApp). Expira em poucos minutos.
                </p>
                <textarea
                  readOnly
                  className="min-h-[100px] w-full rounded-lg border border-border bg-muted/30 p-2 font-mono text-[11px]"
                  value={magicLinkShown}
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => void navigator.clipboard.writeText(magicLinkShown)}
                  >
                    <Copy className="mr-1.5 h-3.5 w-3.5" />
                    Copiar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      setInviteOpen(false)
                      setMagicLinkShown('')
                      setInviteEmail('')
                      setInviteNome('')
                    }}
                  >
                    Fechar
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-foreground">E-mail</span>
                  <Input
                    type="email"
                    autoComplete="off"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="nome@empresa.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-foreground">Nome (opcional)</span>
                  <Input
                    value={inviteNome}
                    onChange={(e) => setInviteNome(e.target.value)}
                    placeholder="Como aparece no perfil"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <span className="text-xs font-medium text-foreground">Organização</span>
                    <Select value={inviteTenantId} onValueChange={(v) => setInviteTenantId(v ?? '')}>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="Escolher tenant" />
                      </SelectTrigger>
                      <SelectContent>
                        {(tenants.data ?? []).map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.nome} ({t.slug})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <span className="text-xs font-medium text-foreground">Papel</span>
                    <Select
                      value={inviteRole}
                      onValueChange={(v) => v && setInviteRole(v as MembershipRole)}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLE_OPTIONS.map(([key, label]) => (
                          <SelectItem key={key} value={key}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {inviteError && <p className="text-xs text-destructive">{inviteError}</p>}
              </>
            )}
          </div>
          {!magicLinkShown && (
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setInviteOpen(false)
                  setInviteError(null)
                }}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!inviteEmail.trim() || !inviteTenantId || sendInvite.isPending}
                onClick={() => void sendInvite.mutateAsync()}
              >
                {sendInvite.isPending ? 'A enviar…' : 'Enviar convite'}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={tenantOpen} onOpenChange={setTenantOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Tenant de distribuidor</DialogTitle>
            <DialogDescription>
              Cria uma organização em <code className="font-mono text-[11px]">alwayson_tenants</code>{' '}
              ligada ao cadastro do distribuidor (um tenant por distribuidor).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {distribuidoresSemTenant.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Todos os distribuidores cadastrados já têm tenant associado.
              </p>
            ) : (
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-foreground">Distribuidor sem tenant</span>
                <Select
                  value={createTenantDistribuidorId}
                  onValueChange={(v) => setCreateTenantDistribuidorId(v ?? '')}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Escolher…" />
                  </SelectTrigger>
                  <SelectContent>
                    {distribuidoresSemTenant.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={() => setTenantOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!createTenantDistribuidorId || createDistribuidorTenant.isPending || distribuidoresSemTenant.length === 0}
              onClick={() => void createDistribuidorTenant.mutateAsync(createTenantDistribuidorId)}
            >
              {createDistribuidorTenant.isPending ? 'A criar…' : 'Criar tenant'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editNomeOpen} onOpenChange={setEditNomeOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar nome</DialogTitle>
          </DialogHeader>
          <div className="px-1 py-2">
            <Input value={editNomeValor} onChange={(e) => setEditNomeValor(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditNomeOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!editNomeUserId || updateProfile.isPending}
              onClick={() =>
                editNomeUserId &&
                void updateProfile.mutateAsync({ userId: editNomeUserId, nome: editNomeValor })
              }
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={membershipsOpen} onOpenChange={setMembershipsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Organizações e papéis</DialogTitle>
            <DialogDescription>
              {membershipsTargetProfile?.email ?? membershipsUserId}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-4 overflow-y-auto px-1 py-2">
            {allMemberships.isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              (allMemberships.data ?? []).map((m) => {
                const tenant = unwrapTenant(m.alwayson_tenants)
                return (
                  <div
                    key={m.id}
                    className="flex flex-col gap-2 rounded-lg border border-border/60 p-3 sm:flex-row sm:items-end"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-sm font-medium leading-tight">{tenant?.nome ?? m.tenant_id}</p>
                      <div className="flex flex-wrap items-center gap-2">
                        {tenant?.tipo && <TenantRoleBadge tipo={tenant.tipo} />}
                        <span className="text-[10px] text-muted-foreground">{tenant?.slug}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Select
                        value={m.role}
                        onValueChange={(v) => {
                          if (!v) return
                          void updateMembership.mutateAsync({ id: m.id, role: v as MembershipRole, ativo: m.ativo })
                        }}
                      >
                        <SelectTrigger className="h-8 w-[140px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLE_OPTIONS.map(([key, label]) => (
                            <SelectItem key={key} value={key}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={m.ativo ? '1' : '0'}
                        onValueChange={(v) => {
                          void updateMembership.mutateAsync({
                            id: m.id,
                            role: m.role,
                            ativo: v === '1',
                          })
                        }}
                      >
                        <SelectTrigger className="h-8 w-[100px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">Ativo</SelectItem>
                          <SelectItem value="0">Inativo</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          if (confirm('Remover este vínculo?')) void deleteMembership.mutateAsync(m.id)
                        }}
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )
              })
            )}

            <div className="border-t border-border/60 pt-3">
              <p className="mb-2 text-xs font-medium text-foreground">Adicionar vínculo</p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <Select value={newMbTenantId} onValueChange={(v) => setNewMbTenantId(v ?? '')}>
                  <SelectTrigger className="h-8 flex-1 text-xs">
                    <SelectValue placeholder="Tenant" />
                  </SelectTrigger>
                  <SelectContent>
                    {(tenants.data ?? []).map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={newMbRole}
                  onValueChange={(v) => v && setNewMbRole(v as MembershipRole)}
                >
                  <SelectTrigger className="h-8 w-[130px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  size="sm"
                  disabled={!membershipsUserId || !newMbTenantId || addMembership.isPending}
                  onClick={() => {
                    if (!membershipsUserId || !newMbTenantId) return
                    void addMembership.mutateAsync({
                      userId: membershipsUserId,
                      tenantId: newMbTenantId,
                      role: newMbRole,
                    })
                  }}
                >
                  Adicionar
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" size="sm" onClick={() => setMembershipsOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                  <TableHead className="w-12 text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles.isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={5}>
                        <Skeleton className="h-7 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : (profiles.data ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                      Sem membros ainda — pode convidar utilizadores ou correr{' '}
                      <code className="font-mono">npm run admin:bootstrap</code>.
                    </TableCell>
                  </TableRow>
                ) : (
                  profiles.data!.map((p) => {
                    const ms = byUser.get(p.user_id) ?? []
                    const isSelf = p.user_id === currentUserId
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
                            <span className="text-xs text-muted-foreground">Sem vínculos (lista)</span>
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
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              type="button"
                              className={cn(
                                buttonVariants({ variant: 'ghost', size: 'icon' }),
                                'h-8 w-8 shrink-0',
                              )}
                              aria-label="Ações do utilizador"
                              title="Ações"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditNomeUserId(p.user_id)
                                  setEditNomeValor(p.nome ?? '')
                                  setEditNomeOpen(true)
                                }}
                              >
                                <Pencil className="mr-2 h-3.5 w-3.5" /> Editar nome
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setMembershipsUserId(p.user_id)
                                  setMembershipsOpen(true)
                                }}
                              >
                                <Building2 className="mr-2 h-3.5 w-3.5" /> Organizações e papéis
                              </DropdownMenuItem>
                              {!isSelf && p.status !== 'suspended' && (
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={() => {
                                    if (confirm('Suspender esta conta? Não poderá aceder à aplicação.'))
                                      void updateProfile.mutateAsync({
                                        userId: p.user_id,
                                        status: 'suspended',
                                      })
                                  }}
                                >
                                  <Ban className="mr-2 h-3.5 w-3.5" /> Suspender
                                </DropdownMenuItem>
                              )}
                              {!isSelf && p.status === 'suspended' && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    void updateProfile.mutateAsync({
                                      userId: p.user_id,
                                      status: 'active',
                                    })
                                  }
                                >
                                  <CheckCircle className="mr-2 h-3.5 w-3.5" /> Reactivar
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
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
            <Badge variant="secondary">{invites.data?.filter((i) => i.status === 'pending').length ?? 0}</Badge>
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
                  <TableHead className="w-24 text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {invites.isLoading ? (
                  Array.from({ length: 2 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={6}>
                        <Skeleton className="h-7 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : (invites.data ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                      Sem convites.
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
                        <TableCell className="text-right">
                          {inv.status === 'pending' && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              disabled={revokeInvite.isPending}
                              onClick={() => {
                                if (confirm('Revogar este convite?')) revokeInvite.mutate(inv.id)
                              }}
                            >
                              Revogar
                            </Button>
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
        <CardContent className="flex items-start gap-3 p-4 text-sm">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="space-y-3">
            <div>
              <p className="font-medium">Resumo · Fase 2</p>
              <p className="text-xs text-muted-foreground">
                Convites utilizam a Edge Function{' '}
                <code className="font-mono">admin-invite-user</code> (service role). Faça{' '}
                <code className="font-mono">npm run admin:deploy-invite-fn</code> e confirme o redirect
                <code className="font-mono"> /aceitar-convite/* </code> nas URL permitidas do Auth.
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-foreground">Organizações (tenants)</p>
              <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-border/60">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Slug</TableHead>
                      <TableHead>Tipo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tenants.isLoading ? (
                      <TableRow>
                        <TableCell colSpan={3}>
                          <Skeleton className="h-6 w-full" />
                        </TableCell>
                      </TableRow>
                    ) : (
                      (tenants.data ?? []).map((t) => (
                        <TableRow key={t.id}>
                          <TableCell className="text-xs font-medium">{t.nome}</TableCell>
                          <TableCell className="font-mono text-[11px] text-muted-foreground">{t.slug}</TableCell>
                          <TableCell>
                            <TenantRoleBadge tipo={t.tipo} />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <Link2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Migração <code className="font-mono">028_admin_phase2_rls.sql</code> abre escritas RLS para
                admin global em tenants, memberships e perfis.
              </span>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
