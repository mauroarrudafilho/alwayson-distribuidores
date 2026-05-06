import { useState, useMemo, useEffect } from 'react'
import { Search, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  adicionarAjuste,
  TIPO_LABELS,
  MOTIVO_LABELS,
  MOTIVOS_POR_TIPO,
  type AjusteTipo,
  type AjusteMotivo,
} from '@/hooks/useMockAjustesCadastro'
import { useClientesBusca } from '@/hooks/useClientesBusca'
import type { ClienteDistribuidor } from '@/types/distribuidor'

export interface AjusteClienteContext {
  id: string
  nome: string
  cnpj: string
  razao_social: string
  nome_fantasia?: string
  endereco?: string
  vendedor_nome?: string
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Cliente pré-selecionado. Quando ausente, o modal mostra um picker de busca. */
  cliente?: AjusteClienteContext
}

function clienteToContext(c: ClienteDistribuidor): AjusteClienteContext {
  return {
    id: c.id,
    nome: c.nome_fantasia || c.razao_social,
    cnpj: c.cnpj,
    razao_social: c.razao_social,
    nome_fantasia: c.nome_fantasia,
    endereco:
      [
        c.endereco_logradouro,
        c.endereco_numero,
        c.endereco_bairro,
        `${c.cidade}/${c.estado}`,
      ]
        .filter(Boolean)
        .join(', ') || undefined,
  }
}

function ClientePicker({
  onSelect,
}: {
  onSelect: (cliente: AjusteClienteContext) => void
}) {
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  const { data, isLoading } = useClientesBusca(debounced)
  const showResults = debounced.length >= 2

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium">Cliente</label>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          placeholder="Buscar por CNPJ, razão social ou nome fantasia…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 text-sm pl-8"
          autoFocus
        />
      </div>

      {showResults && (
        <div className="border rounded-md max-h-60 overflow-y-auto bg-popover">
          {isLoading ? (
            <p className="text-xs text-muted-foreground px-3 py-3 text-center">Carregando…</p>
          ) : !data || data.length === 0 ? (
            <p className="text-xs text-muted-foreground px-3 py-3 text-center">
              Nenhum cliente encontrado para "{debounced}".
            </p>
          ) : (
            <ul className="divide-y">
              {data.slice(0, 8).map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(clienteToContext(c))}
                    className="w-full px-3 py-2 text-left hover:bg-accent transition-colors"
                  >
                    <div className="text-sm font-medium">{c.nome_fantasia || c.razao_social}</div>
                    <div className="text-[11px] text-muted-foreground">
                      <span className="font-mono">{c.cnpj}</span> · {c.cidade}/{c.estado}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function formatCnpj(raw: string) {
  const digits = raw.replace(/\D/g, '').slice(0, 14)
  if (digits.length <= 2) return digits
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`
}

function valorAtualPorTipo(tipo: AjusteTipo, cliente: AjusteClienteContext): string {
  switch (tipo) {
    case 'cnpj':
      return cliente.cnpj
    case 'razao_social':
      return cliente.razao_social
    case 'nome_fantasia':
      return cliente.nome_fantasia ?? '—'
    case 'endereco':
      return cliente.endereco ?? '—'
    case 'vendedor':
      return cliente.vendedor_nome ?? '—'
    case 'outro':
      return '—'
  }
}

function labelAnteriorPorTipo(tipo: AjusteTipo): string {
  switch (tipo) {
    case 'cnpj':
      return 'CNPJ anterior'
    case 'razao_social':
      return 'Razão social anterior'
    case 'nome_fantasia':
      return 'Nome fantasia anterior'
    case 'endereco':
      return 'Endereço anterior'
    case 'vendedor':
      return 'Vendedor anterior'
    case 'outro':
      return 'Valor anterior'
  }
}

function placeholderAnteriorPorTipo(tipo: AjusteTipo): string {
  switch (tipo) {
    case 'cnpj':
      return '00.000.000/0000-00'
    case 'razao_social':
      return 'Razão social anterior do cliente'
    case 'nome_fantasia':
      return 'Nome fantasia anterior'
    case 'endereco':
      return 'Logradouro, nº — bairro, cidade/UF'
    case 'vendedor':
      return 'Nome do vendedor anterior'
    case 'outro':
      return 'Descreva o que mudou'
  }
}

export function AjusteCadastroDialog({ open, onOpenChange, cliente: clienteProp }: Props) {
  const [pickedCliente, setPickedCliente] = useState<AjusteClienteContext | null>(null)
  const [tipo, setTipo] = useState<AjusteTipo>('cnpj')
  const [valorAnterior, setValorAnterior] = useState('')
  const [motivo, setMotivo] = useState<AjusteMotivo | ''>('')
  const [observacao, setObservacao] = useState('')
  const [error, setError] = useState<string | null>(null)

  const cliente = clienteProp ?? pickedCliente
  const valorAtual = useMemo(
    () => (cliente ? valorAtualPorTipo(tipo, cliente) : ''),
    [tipo, cliente]
  )
  const motivosValidos = MOTIVOS_POR_TIPO[tipo]

  function reset() {
    setPickedCliente(null)
    setTipo('cnpj')
    setValorAnterior('')
    setMotivo('')
    setObservacao('')
    setError(null)
  }

  function handleClose(next: boolean) {
    if (!next) reset()
    onOpenChange(next)
  }

  function handleTipoChange(novoTipo: AjusteTipo) {
    setTipo(novoTipo)
    setValorAnterior('')
    if (motivo && !MOTIVOS_POR_TIPO[novoTipo].includes(motivo as AjusteMotivo)) {
      setMotivo('')
    }
  }

  function handleAnteriorChange(v: string) {
    if (tipo === 'cnpj') {
      setValorAnterior(formatCnpj(v))
    } else {
      setValorAnterior(v)
    }
  }

  function handleSubmit() {
    if (!cliente) {
      setError('Selecione um cliente.')
      return
    }
    const trimmed = valorAnterior.trim()
    if (!trimmed) {
      setError('Informe o valor anterior.')
      return
    }
    if (tipo === 'cnpj') {
      const digits = trimmed.replace(/\D/g, '')
      if (digits.length !== 14) {
        setError('CNPJ inválido — informe os 14 dígitos.')
        return
      }
      if (digits === cliente.cnpj.replace(/\D/g, '')) {
        setError('Este CNPJ já é o cadastro atual.')
        return
      }
    }
    if (!motivo) {
      setError('Selecione o motivo do ajuste.')
      return
    }

    adicionarAjuste({
      cliente_id: cliente.id,
      cliente_nome: cliente.nome,
      tipo,
      valor_anterior: trimmed,
      valor_atual: valorAtual,
      motivo,
      observacao: observacao.trim() || undefined,
    })
    handleClose(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo ajuste de cadastro</DialogTitle>
          <DialogDescription>
            Registre uma alteração ou correção no cadastro deste cliente. Todos os ajustes ficam
            auditáveis e podem ser revertidos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Tipo de ajuste</label>
            <Select value={tipo} onValueChange={(v) => handleTipoChange(v as AjusteTipo)}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue>{TIPO_LABELS[tipo]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(TIPO_LABELS) as AjusteTipo[]).map((t) => (
                  <SelectItem key={t} value={t}>
                    {TIPO_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!clienteProp && !cliente ? (
            <ClientePicker onSelect={setPickedCliente} />
          ) : null}

          {!clienteProp && cliente ? (
            <div className="rounded-md border bg-muted/30 px-3 py-2 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-0.5">
                  Cliente
                </div>
                <div className="text-sm font-medium truncate">{cliente.nome}</div>
                <div className="text-[11px] text-muted-foreground">
                  <span className="font-mono">{cliente.cnpj}</span>
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={() => setPickedCliente(null)}
              >
                <X className="w-3 h-3 mr-1" />
                Trocar
              </Button>
            </div>
          ) : null}

          <div className={cliente ? 'space-y-3' : 'space-y-3 opacity-40 pointer-events-none'}>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">{labelAnteriorPorTipo(tipo)}</label>
              {tipo === 'endereco' || tipo === 'outro' ? (
                <Textarea
                  rows={2}
                  placeholder={placeholderAnteriorPorTipo(tipo)}
                  value={valorAnterior}
                  onChange={(e) => handleAnteriorChange(e.target.value)}
                  className="text-sm"
                />
              ) : (
                <Input
                  placeholder={placeholderAnteriorPorTipo(tipo)}
                  value={valorAnterior}
                  onChange={(e) => handleAnteriorChange(e.target.value)}
                  className={tipo === 'cnpj' ? 'font-mono text-sm' : 'text-sm'}
                />
              )}
              <p className="text-[11px] text-muted-foreground">
                Cadastro atual:{' '}
                <span className={tipo === 'cnpj' ? 'font-mono' : ''}>{valorAtual || '—'}</span>
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium">Motivo</label>
              <Select value={motivo} onValueChange={(v) => setMotivo(v as AjusteMotivo)}>
                <SelectTrigger className="h-9 text-sm">
                  {motivo ? (
                    <SelectValue>{MOTIVO_LABELS[motivo]}</SelectValue>
                  ) : (
                    <SelectValue placeholder="Selecione…" />
                  )}
                </SelectTrigger>
                <SelectContent>
                  {motivosValidos.map((m) => (
                    <SelectItem key={m} value={m}>
                      {MOTIVO_LABELS[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium">
                Observação{' '}
                <span className="text-muted-foreground font-normal">(opcional)</span>
              </label>
              <Textarea
                rows={2}
                placeholder="Contexto, referências, etc."
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                className="text-sm"
              />
            </div>
          </div>

          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit}>Registrar ajuste</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
