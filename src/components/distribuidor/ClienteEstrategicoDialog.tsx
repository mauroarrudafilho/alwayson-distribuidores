import { useState } from 'react'
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
  apenasDigitos,
  useSalvarClienteEstrategico,
} from '@/hooks/useClientesEstrategicos'
import {
  ORIGENS_ESTRATEGICAS,
  PRIORIDADES,
  type ClienteEstrategicoLinha,
  type OrigemEstrategica,
  type PrioridadeEstrategica,
} from '@/types/clientes-estrategicos'
import { formatCnpj } from '@/lib/format'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Linha existente: abre em modo edição, com o CNPJ travado. */
  registro?: ClienteEstrategicoLinha | null
}

/**
 * Entrada manual da lista estratégica.
 *
 * A chave é o **CNPJ**, não um cliente da carteira: o alvo pode ser uma loja
 * que ainda ninguém atende. Se o CNPJ já existir em alguma carteira, o gatilho
 * do banco liga-o sozinho — aqui não é preciso escolher cliente.
 *
 * O outro campo que importa é o **motivo**: a lista só tem valor se cada CNPJ
 * carregar a razão pela qual entrou.
 *
 * Montado só quando aberto (ver a página), então o estado inicial sai direto
 * dos props — sem `useEffect` de sincronização.
 */
export function ClienteEstrategicoDialog({ open, onOpenChange, registro }: Props) {
  const editando = Boolean(registro)

  const [cnpj, setCnpj] = useState<string>(registro?.cnpj ?? '')
  const [cidade, setCidade] = useState<string>(registro?.cidade_exibicao ?? '')
  const [estado, setEstado] = useState<string>(registro?.estado_exibicao ?? '')
  const [motivo, setMotivo] = useState<string>(registro?.motivo ?? '')
  const [origem, setOrigem] = useState<OrigemEstrategica | ''>(registro?.origem ?? '')
  const [prioridade, setPrioridade] = useState<PrioridadeEstrategica>(
    registro?.prioridade ?? 'media'
  )
  const [observacao, setObservacao] = useState<string>(registro?.observacao ?? '')
  const [erro, setErro] = useState<string | null>(null)

  const salvar = useSalvarClienteEstrategico()

  async function handleSubmit() {
    setErro(null)
    const digitos = apenasDigitos(cnpj)
    if (digitos.length !== 14 && digitos.length !== 11) {
      return setErro('Informe um CNPJ (14 dígitos) ou CPF (11) válido em comprimento.')
    }
    if (!motivo.trim()) {
      return setErro('Descreva por que este CNPJ é estratégico — é o que dá sentido à lista.')
    }

    try {
      await salvar.mutateAsync({
        id: registro?.id,
        valores: {
          cnpj: digitos,
          // Entrada manual nasce territorial: quem atende resolve-se pelo
          // vínculo com a carteira, não por escolha aqui.
          distribuidor_id: registro?.distribuidor_id ?? null,
          cidade: cidade.trim() || null,
          estado: estado || null,
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
            {editando ? 'Editar CNPJ estratégico' : 'Adicionar CNPJ estratégico'}
          </DialogTitle>
          <DialogDescription>
            Lista curada e manual. O CNPJ não precisa estar na carteira de ninguém — se entrar
            depois, o vínculo com o cliente é feito automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {editando ? (
            <div className="rounded-md border bg-muted/30 px-3 py-2">
              <p className="text-sm font-medium">
                {registro?.nome_exibicao || 'Sem nome em fonte pública'}
              </p>
              <p className="text-[11px] tabular-nums text-muted-foreground">
                {formatCnpj(registro!.cnpj)}
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="text-xs font-medium">
                CNPJ <span className="text-destructive">*</span>
              </label>
              <Input
                value={cnpj}
                onChange={(e) => setCnpj(e.target.value)}
                placeholder="00.000.000/0000-00"
                inputMode="numeric"
                className="h-9 text-sm tabular-nums"
              />
              <p className="text-[11px] text-muted-foreground">
                O nome do PDV não é digitado: resolve-se por fonte pública quando existir.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">
                Cidade <span className="font-normal text-muted-foreground">(opcional)</span>
              </label>
              <Input
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
                placeholder="Ex.: PETROLINA"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">
                UF <span className="font-normal text-muted-foreground">(opcional)</span>
              </label>
              {/* Campo livre e não `ESTADOS_NORDESTE`: aquela lista tem 5 UFs e a
                  lista estratégica já cobre 9 (entram BA, CE, MA e PI). */}
              <Input
                value={estado}
                onChange={(e) => setEstado(e.target.value.toUpperCase().slice(0, 2))}
                placeholder="PE"
                maxLength={2}
                className="h-9 text-sm uppercase"
              />
            </div>
          </div>

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

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
