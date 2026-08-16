import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Building2, Search, MapPin, Phone, Mail, Plus, Loader2 } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { StatusBadge } from '@/components/distribuidor/StatusBadge'
import { FilterBar, FilterField } from '@/components/distribuidor/FilterBar'
import { useDistribuidores } from '@/hooks/useDistribuidores'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { supabase } from '@/lib/supabase'
import { formatCnpj } from '@/lib/format'
import {
  humanizeBrasilApiCnpjError,
  lookupBrasilApiCnpj,
  type BrasilApiCnpjResult,
} from '@/lib/brasilApiCnpj'
import { ESTADOS_NORDESTE, type EstadoNordeste } from '@/types/distribuidor'

type StatusFiltro = 'todos' | 'ativo' | 'inativo' | 'em_analise'

type FormState = {
  cnpj: string
  responsavel: string
  lead_time_dias: string
  criarTenant: boolean
}

const EMPTY_FORM: FormState = {
  cnpj: '',
  responsavel: '',
  lead_time_dias: '7',
  criarTenant: true,
}

const ESTADOS_SET = new Set(ESTADOS_NORDESTE.map((e) => e.value))

function slugifyDistribuidor(nome: string): string {
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 42)
}

function digitsOnly(raw: string): string {
  return raw.replace(/\D/g, '')
}

type LookupOk = Extract<BrasilApiCnpjResult, { ok: true }>

export function AdminDistribuidores() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data: distribuidores, isLoading } = useDistribuidores()
  const [search, setSearch] = useState('')
  const [estadoFilter, setEstadoFilter] = useState<string>('todos')
  const [statusFilter, setStatusFilter] = useState<StatusFiltro>('todos')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [lookup, setLookup] = useState<LookupOk | null>(null)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupError, setLookupError] = useState<string | null>(null)

  const createDistribuidor = useMutation({
    mutationFn: async (values: FormState) => {
      if (!lookup) {
        throw new Error('Consulte o CNPJ na Receita antes de cadastrar.')
      }
      if (!ESTADOS_SET.has(lookup.uf as EstadoNordeste)) {
        throw new Error(
          `UF ${lookup.uf || '—'} fora da cobertura (PE, PB, RN, AL, SE).`
        )
      }
      if (!lookup.cidade) {
        throw new Error('A Receita não retornou a cidade deste CNPJ.')
      }
      const responsavel = values.responsavel.trim() || lookup.responsavel?.trim()
      if (!responsavel) {
        throw new Error('Informe o responsável comercial.')
      }

      const cnpj = formatCnpj(lookup.cnpj14)
      const lead = Number.parseInt(values.lead_time_dias || '7', 10)
      const lead_time_dias = Number.isFinite(lead) && lead > 0 ? lead : 7
      const status: 'ativo' | 'em_analise' = lookup.cadastroAtivo ? 'ativo' : 'em_analise'

      const { data: dist, error } = await supabase
        .from('alwayson_distribuidores')
        .insert({
          nome: lookup.razaoSocial,
          cnpj,
          estado: lookup.uf,
          cidade: lookup.cidade,
          responsavel,
          email: lookup.email,
          telefone: lookup.telefone,
          lead_time_dias,
          status,
        })
        .select('id, nome')
        .single()

      if (error) {
        if (error.code === '23505') {
          throw new Error('Já existe um distribuidor com este CNPJ.')
        }
        throw error
      }

      if (values.criarTenant && dist) {
        let base = slugifyDistribuidor(dist.nome || 'tenant')
        if (!base) base = 'distribuidor'
        let slug = base
        for (let n = 0; n < 25; n++) {
          const { data: clash } = await supabase
            .from('alwayson_tenants')
            .select('id')
            .eq('slug', slug)
            .maybeSingle()
          if (!clash) break
          slug = `${base}-${n + 1}`
        }
        const { error: tenantError } = await supabase.from('alwayson_tenants').insert({
          tipo: 'distribuidor',
          nome: dist.nome,
          slug,
          distribuidor_id: dist.id,
          ativo: true,
        })
        if (tenantError) {
          throw new Error(
            `Distribuidor criado, mas falhou ao criar o tenant: ${tenantError.message}`
          )
        }
      }

      return dist
    },
    onSuccess: async (dist) => {
      await qc.invalidateQueries({ queryKey: ['distribuidores'] })
      await qc.invalidateQueries({ queryKey: ['admin', 'usuarios'] })
      resetDialog()
      setOpen(false)
      if (dist?.id) navigate(`/parceiros/${dist.id}`)
    },
    onError: (err) => {
      setFormError(err instanceof Error ? err.message : 'Falha ao cadastrar distribuidor.')
    },
  })

  const filtered = (distribuidores ?? []).filter((d) => {
    const matchSearch =
      !search ||
      d.nome.toLowerCase().includes(search.toLowerCase()) ||
      d.cnpj.includes(search) ||
      d.cidade.toLowerCase().includes(search.toLowerCase())
    const matchEstado = estadoFilter === 'todos' || d.estado === estadoFilter
    const matchStatus = statusFilter === 'todos' || d.status === statusFilter
    return matchSearch && matchEstado && matchStatus
  })

  function resetDialog() {
    setForm(EMPTY_FORM)
    setFormError(null)
    setLookup(null)
    setLookupError(null)
    setLookupLoading(false)
  }

  function openCreate() {
    resetDialog()
    setOpen(true)
  }

  async function handleLookup() {
    setLookupError(null)
    setFormError(null)
    setLookup(null)
    const digits = digitsOnly(form.cnpj)
    if (digits.length !== 14) {
      setLookupError('Informe os 14 dígitos do CNPJ.')
      return
    }
    setLookupLoading(true)
    try {
      const result = await lookupBrasilApiCnpj(digits)
      if (!result.ok) {
        setLookupError(humanizeBrasilApiCnpjError(result.reason))
        return
      }
      setLookup(result)
      setForm((f) => ({
        ...f,
        cnpj: formatCnpj(result.cnpj14),
        responsavel: result.responsavel ?? f.responsavel,
      }))
    } finally {
      setLookupLoading(false)
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!lookup) {
      setFormError('Consulte o CNPJ na Receita antes de cadastrar.')
      return
    }
    void createDistribuidor.mutateAsync(form)
  }

  const ufForaCobertura = lookup != null && !ESTADOS_SET.has(lookup.uf as EstadoNordeste)

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button type="button" size="sm" onClick={openCreate}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Novo distribuidor
        </Button>
      </div>

      <FilterBar>
        <FilterField label="Buscar">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="h-8 text-sm pl-8 placeholder:text-muted-foreground"
              placeholder="Nome, CNPJ ou cidade..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </FilterField>
        <FilterField label="Estado">
          <Select value={estadoFilter} onValueChange={(v) => setEstadoFilter(v ?? 'todos')}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os estados</SelectItem>
              {ESTADOS_NORDESTE.map((e) => (
                <SelectItem key={e.value} value={e.value}>
                  {e.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label="Status">
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter((v as StatusFiltro) ?? 'todos')}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="inativo">Inativo</SelectItem>
              <SelectItem value="em_analise">Em Analise</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>
      </FilterBar>

      <Card>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Distribuidor</TableHead>
              <TableHead>CNPJ</TableHead>
              <TableHead>Localização</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right w-[90px]">Gerir</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center">
                  <Building2 className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground mb-3">
                    Nenhum distribuidor encontrado
                  </p>
                  <Button type="button" size="sm" variant="outline" onClick={openCreate}>
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Cadastrar distribuidor
                  </Button>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((dist) => (
                <TableRow key={dist.id}>
                  <TableCell className="text-xs font-medium">
                    <Link
                      to={`/parceiros/${dist.id}`}
                      className="text-primary hover:underline"
                    >
                      {dist.nome}
                    </Link>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground tabular-nums">
                    {dist.cnpj}
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="w-3.5 h-3.5" />
                      {dist.cidade} - {dist.estado}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs">
                    {dist.responsavel}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {dist.telefone && (
                        <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                      )}
                      {dist.email && (
                        <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={dist.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      to={`/parceiros/${dist.id}`}
                      className="text-xs text-primary hover:underline"
                    >
                      Abrir
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) resetDialog()
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo distribuidor</DialogTitle>
            <DialogDescription>
              Informe o CNPJ — buscamos razão social, cidade e contato na Receita (BrasilAPI).
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="CNPJ">
              <div className="flex gap-2">
                <Input
                  required
                  value={form.cnpj}
                  onChange={(e) => {
                    const next = formatCnpj(e.target.value)
                    setForm((f) => ({ ...f, cnpj: next }))
                    if (lookup && digitsOnly(next) !== lookup.cnpj14) {
                      setLookup(null)
                      setLookupError(null)
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      void handleLookup()
                    }
                  }}
                  className="h-9 font-mono tabular-nums"
                  placeholder="00.000.000/0000-00"
                  inputMode="numeric"
                  autoFocus
                />
                <Button
                  type="button"
                  size="sm"
                  className="h-9 shrink-0"
                  disabled={lookupLoading || digitsOnly(form.cnpj).length !== 14}
                  onClick={() => void handleLookup()}
                >
                  {lookupLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Search className="mr-1.5 h-3.5 w-3.5" />
                      Buscar
                    </>
                  )}
                </Button>
              </div>
            </Field>

            {lookupError && (
              <p role="alert" className="text-xs text-destructive">
                {lookupError}
              </p>
            )}

            {lookup && (
              <div className="space-y-3 rounded-md border border-border/60 bg-muted/30 p-3">
                <div>
                  <p className="text-sm font-medium text-foreground leading-snug">
                    {lookup.razaoSocial}
                  </p>
                  {lookup.nomeFantasia && (
                    <p className="text-xs text-muted-foreground mt-0.5">{lookup.nomeFantasia}</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {lookup.cidade || '—'} / {lookup.uf || '—'}
                  </span>
                  {lookup.situacao && <span>Situação: {lookup.situacao}</span>}
                </div>
                {(lookup.email || lookup.telefone) && (
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {lookup.email && (
                      <span className="inline-flex items-center gap-1">
                        <Mail className="h-3.5 w-3.5" />
                        {lookup.email}
                      </span>
                    )}
                    {lookup.telefone && (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="h-3.5 w-3.5" />
                        {lookup.telefone}
                      </span>
                    )}
                  </div>
                )}
                {ufForaCobertura && (
                  <p className="text-xs text-warning ">
                    UF {lookup.uf} fora da cobertura Nordeste (PE, PB, RN, AL, SE). Não é possível
                    cadastrar.
                  </p>
                )}
              </div>
            )}

            {lookup && !ufForaCobertura && (
              <>
                <Field label="Responsável comercial">
                  <Input
                    required
                    value={form.responsavel}
                    onChange={(e) => setForm((f) => ({ ...f, responsavel: e.target.value }))}
                    className="h-9"
                    placeholder="Nome do contato"
                  />
                </Field>
                <Field label="Lead time (dias)">
                  <Input
                    type="number"
                    min={1}
                    value={form.lead_time_dias}
                    onChange={(e) => setForm((f) => ({ ...f, lead_time_dias: e.target.value }))}
                    className="h-9 max-w-[120px]"
                  />
                </Field>
                <label className="flex items-start gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={form.criarTenant}
                    onChange={(e) => setForm((f) => ({ ...f, criarTenant: e.target.checked }))}
                  />
                  <span>Criar tenant de acesso (para convites em Usuários).</span>
                </label>
              </>
            )}

            {formError && (
              <p role="alert" className="text-xs text-destructive">
                {formError}
              </p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={createDistribuidor.isPending}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={
                  createDistribuidor.isPending ||
                  !lookup ||
                  ufForaCobertura ||
                  !form.responsavel.trim()
                }
              >
                {createDistribuidor.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Cadastrar'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Field({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  )
}
