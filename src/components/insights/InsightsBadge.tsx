import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart3, ArrowRight, DollarSign, Receipt, ShoppingCart } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useClienteEmInsights } from '@/hooks/useClienteEmInsights'
import { formatCurrency } from '@/lib/format'

interface Props {
  /** CNPJ do cliente (pode vir com ou sem máscara). */
  cnpj: string | null | undefined
  /** Faturamento ingerido localmente (sell-in) — opcional, para comparativo. */
  faturamentoLocal?: number | null
  /** Total de NFs ingeridas localmente — opcional. */
  nfsLocais?: number | null
}

export function InsightsBadge({ cnpj, faturamentoLocal, nfsLocais }: Props) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const result = useClienteEmInsights(cnpj)

  if (!result.existe) return null

  const { cliente, historico } = result
  const insightsFaturamento = cliente.faturamento_total
  const insightsNfs = cliente.total_nfs

  function abrirInsights() {
    setOpen(false)
    navigate(`/insights?cnpj=${encodeURIComponent(cliente.cnpj_cliente)}`)
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
        }}
        title="Cliente possui dados no Insights"
        className="inline-flex items-center justify-center w-5 h-5 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
      >
        <BarChart3 className="w-3.5 h-3.5" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              Dados de Insights disponíveis
            </DialogTitle>
            <DialogDescription>
              {cliente.nome_cliente} · <span className="font-mono text-xs">{cliente.cnpj_cliente}</span>
              <br />
              {cliente.cidade}/{cliente.estado}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {/* Comparativo de Faturamento */}
            <div className="rounded-md border bg-muted/20 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <DollarSign className="w-3 h-3" />
                Faturamento — Sell-in vs Sell-out
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] text-muted-foreground">Sell-in (local)</p>
                  <p className="text-sm font-semibold tabular-nums">
                    {faturamentoLocal != null ? formatCurrency(faturamentoLocal) : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Sell-out (Insights)</p>
                  <p className="text-sm font-semibold tabular-nums">{formatCurrency(insightsFaturamento)}</p>
                </div>
              </div>
            </div>

            {/* NFs */}
            <div className="rounded-md border bg-muted/20 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <Receipt className="w-3 h-3" />
                NFs — Sell-in vs Sell-out
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] text-muted-foreground">Sell-in (local)</p>
                  <p className="text-sm font-semibold tabular-nums">
                    {nfsLocais != null ? nfsLocais : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Sell-out (Insights)</p>
                  <p className="text-sm font-semibold tabular-nums">{insightsNfs}</p>
                </div>
              </div>
            </div>

            {/* Última compra Insights */}
            <div className="rounded-md border bg-muted/20 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
                <ShoppingCart className="w-3 h-3" />
                Última compra (Insights)
              </p>
              <p className="text-sm font-semibold tabular-nums">
                {new Date(cliente.ultima_compra + 'T12:00:00').toLocaleDateString('pt-BR')}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                {historico.length} {historico.length === 1 ? 'mês' : 'meses'} de histórico · {cliente.total_skus} SKUs
              </p>
            </div>

            <p className="text-[11px] text-muted-foreground italic">
              Estes números refletem dados externos (sell-out reportado pelo distribuidor) — apenas informativos.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2 -mx-4 -mb-4 px-4 py-3 border-t bg-muted/40 rounded-b-xl">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Fechar
            </Button>
            <Button onClick={abrirInsights}>
              Abrir no Insights
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
