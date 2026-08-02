import { useMemo, useState } from 'react'
import { Info } from 'lucide-react'
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
import { useVendedores } from '@/hooks/useDistribuidorPerformance'
import {
  useUpsertMeta,
  useHistoricoParaMeta,
  type MetaComNomes,
} from '@/hooks/useMetas'
import { formatCurrency } from '@/lib/format'
import { monthStart, monthEnd, getCurrentMonth } from '@/lib/periodo'
import type { Meta } from '@/types/distribuidor'

const HIERARQUIAS: { value: Meta['hierarquia']; label: string }[] = [
  { value: 'distribuidor', label: 'Distribuidor' },
  { value: 'gerente', label: 'Gerente' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'vendedor', label: 'Vendedor' },
]

const TIPOS: { value: Meta['tipo']; label: string; unidade: 'moeda' | 'contagem' }[] = [
  { value: 'faturamento', label: 'Faturamento', unidade: 'moeda' },
  { value: 'positivacao', label: 'Positivação (clientes)', unidade: 'contagem' },
  { value: 'mix', label: 'Mix (SKUs)', unidade: 'contagem' },
  { value: 'clientes_estrategicos', label: 'Clientes Estratégicos', unidade: 'contagem' },
]

/** Hierarquias que correspondem a uma pessoa em alwayson_vendedores_distribuidor. */
const TIPO_VENDEDOR_POR_HIERARQUIA: Record<string, Meta['hierarquia'] | undefined> = {
  vendedor: 'vendedor',
  supervisor: 'supervisor',
  gerente: 'gerente',
}

/** Primeiro e último dia do mês YYYY-MM. */
function limitesDoMes(mes: string): { inicio: string; fim: string } {
  return { inicio: monthStart(mes), fim: monthEnd(mes) }
}

/** Mesmo mês do ano anterior — base de comparação para a meta. */
function mesmoMesAnoAnterior(mes: string): string {
  const [ano, m] = mes.split('-').map(Number)
  return `${ano - 1}-${String(m).padStart(2, '0')}`
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  distribuidorId?: string
  /** Meta existente — abre em modo edição. */
  meta?: MetaComNomes | null
}

/**
 * Só é montado quando aberto (ver `AdminMetas`), então o estado inicial vem
 * direto dos props — sem `useEffect` de sincronização e sem render em cascata.
 */
export function MetaDialog({ open, onOpenChange, distribuidorId, meta }: Props) {
  const editando = Boolean(meta)

  const [hierarquia, setHierarquia] = useState<Meta['hierarquia']>(meta?.hierarquia ?? 'vendedor')
  const [vendedorId, setVendedorId] = useState<string>(meta?.vendedor_id ?? '')
  const [tipo, setTipo] = useState<Meta['tipo']>(meta?.tipo ?? 'faturamento')
  const [mes, setMes] = useState<string>(meta ? meta.periodo_inicio.slice(0, 7) : getCurrentMonth())
  const [valorMeta, setValorMeta] = useState<string>(meta ? String(meta.valor_meta) : '')
  const [observacao, setObservacao] = useState<string>(meta?.observacao ?? '')
  const [erro, setErro] = useState<string | null>(null)

  const upsert = useUpsertMeta()
  const { data: vendedores } = useVendedores(distribuidorId)

  const periodo = useMemo(() => limitesDoMes(mes), [mes])
  const precisaVendedor = hierarquia !== 'distribuidor'

  const opcoesVendedor = useMemo(() => {
    const alvo = TIPO_VENDEDOR_POR_HIERARQUIA[hierarquia]
    return (vendedores ?? []).filter((v) => v.tipo === alvo)
  }, [vendedores, hierarquia])

  // Apoio histórico: mesmo mês do ano anterior.
  const periodoAnterior = useMemo(() => limitesDoMes(mesmoMesAnoAnterior(mes)), [mes])
  const { data: historico } = useHistoricoParaMeta({
    distribuidorId,
    vendedorId: precisaVendedor ? vendedorId || null : null,
    periodoInicio: periodoAnterior.inicio,
    periodoFim: periodoAnterior.fim,
    enabled: open && (!precisaVendedor || Boolean(vendedorId)),
  })

  const unidade = TIPOS.find((t) => t.value === tipo)?.unidade ?? 'moeda'

  function baseHistorica(): number | null {
    if (!historico) return null
    if (tipo === 'faturamento') return historico.faturamento
    if (tipo === 'positivacao') return historico.clientes
    return null
  }

  const base = baseHistorica()

  function formatarValor(v: number) {
    return unidade === 'moeda' ? formatCurrency(v) : v.toLocaleString('pt-BR')
  }

  async function handleSubmit() {
    setErro(null)
    if (!distribuidorId) {
      setErro('Selecione um distribuidor.')
      return
    }
    if (precisaVendedor && !vendedorId) {
      setErro('Selecione o responsável.')
      return
    }
    const valor = Number(String(valorMeta).replace(',', '.'))
    if (!Number.isFinite(valor) || valor <= 0) {
      setErro('Informe um valor de meta maior que zero.')
      return
    }

    try {
      await upsert.mutateAsync({
        distribuidor_id: distribuidorId,
        vendedor_id: precisaVendedor ? vendedorId : null,
        hierarquia,
        tipo,
        periodo_inicio: periodo.inicio,
        periodo_fim: periodo.fim,
        valor_meta: valor,
        observacao: observacao.trim() || null,
      })
      onOpenChange(false)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao gravar a meta.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editando ? 'Editar meta' : 'Nova meta'}</DialogTitle>
          <DialogDescription>
            Metas de supervisor e gerente são independentes da soma da equipe — a diferença
            entre elas é a venda direta do próprio nível.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Hierarquia</label>
              <Select
                value={hierarquia}
                onValueChange={(v) => {
                  setHierarquia(v as Meta['hierarquia'])
                  setVendedorId('')
                }}
                disabled={editando}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HIERARQUIAS.map((h) => (
                    <SelectItem key={h.value} value={h.value}>
                      {h.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium">Métrica</label>
              <Select
                value={tipo}
                onValueChange={(v) => setTipo(v as Meta['tipo'])}
                disabled={editando}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {precisaVendedor && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Responsável</label>
              <Select
                value={vendedorId}
                onValueChange={(v) => setVendedorId(v ?? '')}
                disabled={editando}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Selecione…" />
                </SelectTrigger>
                <SelectContent>
                  {opcoesVendedor.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {opcoesVendedor.length === 0 && (
                <p className="text-[11px] text-muted-foreground">
                  Nenhum {hierarquia} cadastrado neste distribuidor.
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Mês</label>
              <Input
                type="month"
                value={mes}
                onChange={(e) => setMes(e.target.value)}
                disabled={editando}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">
                Valor da meta {unidade === 'moeda' ? '(R$)' : '(qtd.)'}
              </label>
              <Input
                inputMode="decimal"
                value={valorMeta}
                onChange={(e) => setValorMeta(e.target.value)}
                placeholder={unidade === 'moeda' ? '150000' : '40'}
                className="h-9 text-sm tabular-nums"
              />
            </div>
          </div>

          {/* Apoio histórico para embasar o número. */}
          {base !== null && (
            <div className="rounded-md border bg-muted/30 px-3 py-2 space-y-1">
              <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
                <Info className="w-3 h-3" />
                Referência histórica
              </div>
              <p className="text-sm">
                Mesmo mês do ano anterior:{' '}
                <span className="font-medium tabular-nums">{formatarValor(base)}</span>
              </p>
              {Number(valorMeta) > 0 && base > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  A meta informada representa{' '}
                  <span className="tabular-nums">
                    {((Number(String(valorMeta).replace(',', '.')) / base) * 100).toFixed(0)}%
                  </span>{' '}
                  do realizado naquele período.
                </p>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium">
              Justificativa <span className="text-muted-foreground font-normal">(opcional)</span>
            </label>
            <Textarea
              rows={2}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Base usada, premissa comercial, ajuste combinado com o parceiro…"
              className="text-sm"
            />
          </div>

          {editando && (
            <p className="text-[11px] text-muted-foreground">
              Hierarquia, métrica, responsável e período compõem a chave da meta — para alterá-los,
              exclua e crie novamente.
            </p>
          )}

          {erro && <p className="text-xs text-destructive">{erro}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={upsert.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={upsert.isPending}>
            {upsert.isPending ? 'Gravando…' : 'Gravar meta'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
