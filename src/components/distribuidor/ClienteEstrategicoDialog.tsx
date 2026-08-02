import { useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useDistribuidores } from '@/hooks/useDistribuidores'
import {
  useClientesDisponiveis,
  useSalvarClienteEstrategico,
} from '@/hooks/useClientesEstrategicos'
import {
  ORIGENS_ESTRATEGICAS,
  PRIORIDADES,
  type ClienteEstrategicoComCliente,
  type OrigemEstrategica,
  type PrioridadeEstrategica,
} from '@/types/clientes-estrategicos'
import { formatCnpj } from '@/lib/format'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Distribuidor pré-selecionado pelo filtro da página. */
  distribuidorPadrao?: string
  /** Já na lista — não reaparecem no seletor. */
  idsNaLista: string[]
  /** Linha existente: abre em modo edição, com o cliente travado. */
  registro?: ClienteEstrategicoComCliente | null
}

/**
 * Entrada manual da lista estratégica.
 *
 * O campo que importa é o **motivo**: a lista só tem valor se cada cliente
 * carregar a razão pela qual entrou. Por isso ele é obrigatório aqui, mesmo
 * sendo nullable no banco (linhas antigas/importadas podem não ter).
 *
 * Montado só quando aberto (ver a página), então o estado inicial sai direto
 * dos props — sem `useEffect` de sincronização.
 */
export function ClienteEstrategicoDialog({
  open,
  onOpenChange,
  distribuidorPadrao,
  idsNaLista,
  registro,
}: Props) {
  const editando = Boolean(registro)

  const [distribuidorId, setDistribuidorId] = useState<string>(
    registro?.distribuidor_id ?? distribuidorPadrao ?? ''
  )
  const [clienteId, setClienteId] = useState<string>(registro?.cliente_id ?? '')
  const [motivo, setMotivo] = useState<string>(registro?.motivo ?? '')
  const [origem, setOrigem] = useState<OrigemEstrategica | ''>(registro?.origem ?? '')
  const [prioridade, setPrioridade] = useState<PrioridadeEstrategica>(
    registro?.prioridade ?? 'media'
  )
  const [observacao, setObservacao] = useState<string>(registro?.observacao ?? '')
  const [erro, setErro] = useState<string | null>(null)

  const { data: distribuidores } = useDistribuidores()
  const { data: disponiveis, isLoading: carregandoClientes } = useClientesDisponiveis(
    editando ? undefined : distribuidorId || undefined,
    idsNaLista
  )
  const salvar = useSalvarClienteEstrategico()

  const clienteSelecionado = useMemo(() => {
    if (registro?.cliente) return registro.cliente
    return (disponiveis ?? []).find((c) => c.id === clienteId) ?? null
  }, [registro, disponiveis, clienteId])

  async function handleSubmit() {
    setErro(null)
    if (!distribuidorId) return setErro('Selecione o distribuidor.')
    if (!clienteId) return setErro('Selecione o cliente.')
    if (!motivo.trim()) {
      return setErro('Descreva por que este cliente é estratégico — é o que dá sentido à lista.')
    }

    try {
      await salvar.mutateAsync({
        id: registro?.id,
        valores: {
          distribuidor_id: distribuidorId,
          cliente_id: clienteId,
          motivo: motivo.trim(),
          origem: origem || null,
          prioridade,
          observacao: observacao.trim() || null,
        },
      })
      onOpenChange(false)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao gravar.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editando ? 'Editar cliente estratégico' : 'Adicionar cliente estratégico'}
          </DialogTitle>
          <DialogDescription>
            Lista curada e manual. Cada cliente entra com o seu próprio motivo e passa a ser
            acompanhado por aqui.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {editando ? (
            <div className="rounded-md border bg-muted/30 px-3 py-2">
              <p className="text-sm font-medium">
                {clienteSelecionado?.nome_fantasia || clienteSelecionado?.razao_social || '—'}
              </p>
              <p className="text-[11px] tabular-nums text-muted-foreground">
                {clienteSelecionado?.cnpj ? formatCnpj(clienteSelecionado.cnpj) : '—'}
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Distribuidor</label>
                <Select
                  value={distribuidorId}
                  onValueChange={(v) => {
                    setDistribuidorId(v ?? '')
                    setClienteId('')
                  }}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Selecione…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(distribuidores ?? []).map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium">Cliente</label>
                <Command className="rounded-md border">
                  <CommandInput placeholder="Buscar por razão social, fantasia ou CNPJ…" />
                  <CommandList className="max-h-44">
                    {!distribuidorId ? (
                      <CommandEmpty>Selecione um distribuidor primeiro.</CommandEmpty>
                    ) : carregandoClientes ? (
                      <CommandEmpty>Carregando carteira…</CommandEmpty>
                    ) : (
                      <>
                        <CommandEmpty>Nenhum cliente disponível.</CommandEmpty>
                        <CommandGroup>
                          {(disponiveis ?? []).map((c) => (
                            <CommandItem
                              key={c.id}
                              value={`${c.razao_social} ${c.nome_fantasia ?? ''} ${c.cnpj}`}
                              onSelect={() => setClienteId(c.id)}
                              className={
                                c.id === clienteId ? 'bg-accent text-accent-foreground' : ''
                              }
                            >
                              <div className="min-w-0">
                                <p className="truncate text-xs font-medium">
                                  {c.nome_fantasia || c.razao_social}
                                </p>
                                <p className="truncate text-[11px] tabular-nums text-muted-foreground">
                                  {formatCnpj(c.cnpj)} · {c.cidade}/{c.estado}
                                </p>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </>
                    )}
                  </CommandList>
                </Command>
                {clienteSelecionado && (
                  <p className="text-[11px] text-muted-foreground">
                    Selecionado:{' '}
                    <span className="text-foreground">
                      {clienteSelecionado.nome_fantasia || clienteSelecionado.razao_social}
                    </span>
                  </p>
                )}
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium">
              Por que é estratégico? <span className="text-destructive">*</span>
            </label>
            <Textarea
              rows={3}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: maior sell-out da categoria na cidade, hoje comprado por concorrente."
              className="text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Origem</label>
              <Select
                value={origem || undefined}
                onValueChange={(v) => setOrigem((v ?? '') as OrigemEstrategica | '')}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Opcional" />
                </SelectTrigger>
                <SelectContent>
                  {ORIGENS_ESTRATEGICAS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Prioridade</label>
              <Select
                value={prioridade}
                onValueChange={(v) => setPrioridade((v ?? 'media') as PrioridadeEstrategica)}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORIDADES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium">
              Observação <span className="font-normal text-muted-foreground">(opcional)</span>
            </label>
            <Textarea
              rows={2}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Combinado com o parceiro, próximo passo, contato…"
              className="text-sm"
            />
          </div>

          {erro && <p className="text-xs text-destructive">{erro}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvar.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={salvar.isPending}>
            {salvar.isPending ? 'Gravando…' : editando ? 'Gravar' : 'Adicionar à lista'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
