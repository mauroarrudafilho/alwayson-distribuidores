import { useNavigate } from 'react-router-dom'
import { Building2, Check, ChevronDown, KeyRound, LogOut, ShieldCheck, Users } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth, type MembershipRole, type TenantTipo } from '@/contexts/auth'
import { cn } from '@/lib/utils'

const roleLabel: Record<MembershipRole, string> = {
  admin: 'Admin',
  gestor: 'Gestor',
  gestor_cliente: 'Gestor cliente',
  gestor_fornecedor: 'Gestor fornecedor',
  vendedor: 'Vendedor',
  supervisor: 'Supervisor',
  gerente: 'Gerente',
}

const tipoIcon: Record<TenantTipo, typeof Building2> = {
  admin_global: ShieldCheck,
  fornecedor: Users,
  distribuidor: Building2,
}

export function TenantSwitcher({ collapsed }: { collapsed: boolean }) {
  const { profile, memberships, currentTenant, setCurrentTenantById, signOut } = useAuth()
  const navigate = useNavigate()

  if (!currentTenant) return null

  const Icon = tipoIcon[currentTenant.tipo] ?? Building2
  const initials = (profile?.nome || profile?.email || '?')
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'group flex w-full items-center gap-2 rounded-md p-2 text-left text-sm outline-hidden transition-colors hover:bg-muted/50 focus-visible:bg-muted/50',
          collapsed && 'justify-center px-1'
        )}
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
          {initials}
        </span>
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium text-foreground">
                {currentTenant.nome}
              </span>
              <span className="block truncate text-[11px] text-muted-foreground">
                {roleLabel[currentTenant.role]}
              </span>
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" sideOffset={8} className="min-w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <div className="flex flex-col">
              <span className="text-xs font-medium text-foreground">
                {profile?.nome || profile?.email}
              </span>
              <span className="text-[11px] text-muted-foreground">{profile?.email}</span>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel className="pt-1">Organizações</DropdownMenuLabel>
          {memberships.map((m) => {
            const ItemIcon = tipoIcon[m.tipo] ?? Building2
            const active = m.tenant_id === currentTenant.tenant_id
            return (
              <DropdownMenuItem
                key={`${m.tenant_id}-${m.role}`}
                onClick={() => setCurrentTenantById(m.tenant_id)}
                className="gap-2"
              >
                <ItemIcon className="h-4 w-4 text-muted-foreground" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm">{m.nome}</span>
                  <span className="text-[11px] text-muted-foreground">{roleLabel[m.role]}</span>
                </span>
                {active && <Check className="h-3.5 w-3.5 text-primary" />}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate('/conta')} className="gap-2">
          <KeyRound className="h-4 w-4 text-muted-foreground" /> Minha conta
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => void signOut()} className="gap-2">
          <LogOut className="h-4 w-4" /> Sair
        </DropdownMenuItem>
        <div className="px-1.5 pb-1 pt-0.5">
          <p className="text-[10px] text-muted-foreground">
            <Icon className="mr-1 inline h-3 w-3 align-text-bottom" />
            {currentTenant.tipo === 'admin_global'
              ? 'Visão admin global'
              : currentTenant.tipo === 'fornecedor'
                ? 'Visão fornecedor'
                : 'Visão distribuidor'}
          </p>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
